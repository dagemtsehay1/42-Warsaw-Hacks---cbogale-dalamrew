import type { PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query, withClient } from "@/lib/db/pool";
import { hasForecastFor, runForecastJob } from "@/features/campus/forecast-job";
import { runIngest } from "@/features/campus/ingest";
import { runDueJobs } from "./scheduler";

vi.mock("@/lib/db/pool", () => ({ query: vi.fn(), withClient: vi.fn(), hasDatabase: vi.fn(), migrate: vi.fn() }));
vi.mock("@/features/campus/forecast-job", () => ({ hasForecastFor: vi.fn(), runForecastJob: vi.fn() }));
vi.mock("@/features/campus/ingest", () => ({ runIngest: vi.fn() }));
const dbQuery = vi.fn();
let ingestDue = true;

beforeEach(() => {
  vi.resetAllMocks();
  ingestDue = true;
  dbQuery.mockResolvedValue({ rows: [{ locked: true }] });
  vi.mocked(withClient).mockImplementation(async (fn) => fn({ query: dbQuery } as unknown as PoolClient));
  vi.mocked(query).mockImplementation(async (sql) => {
    if (sql.includes("AS due")) return [{ due: ingestDue }];
    if (sql.includes("INSERT INTO job_runs")) return [{ id: "1" }];
    return [];
  });
  vi.mocked(hasForecastFor).mockResolvedValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("dashboard job schedule", () => {
  it("runs due ingests and records success", async () => {
    await runDueJobs();
    expect(runIngest).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO job_runs"), ["ingest"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'success'"), ["1", '{}']);
    expect(dbQuery).toHaveBeenLastCalledWith("SELECT pg_advisory_unlock($1)", expect.any(Array));
  });

  it("skips work when ingest and forecast are current", async () => {
    ingestDue = false;
    await runDueJobs();
    expect(runIngest).not.toHaveBeenCalled();
    expect(runForecastJob).not.toHaveBeenCalled();
  });

  it("records an ingest failure and still runs a due forecast", async () => {
    vi.mocked(runIngest).mockRejectedValue(new Error("API unavailable"));
    vi.mocked(hasForecastFor).mockResolvedValue(false);
    await runDueJobs();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"), ["1", '{"error":"API unavailable"}']);
    expect(runForecastJob).toHaveBeenCalledOnce();
    expect(dbQuery).toHaveBeenLastCalledWith("SELECT pg_advisory_unlock($1)", expect.any(Array));
  });

  it("does no work while another app instance owns the advisory lock", async () => {
    dbQuery.mockResolvedValue({ rows: [{ locked: false }] });
    await runDueJobs();
    expect(query).not.toHaveBeenCalled();
    expect(runIngest).not.toHaveBeenCalled();
    expect(runForecastJob).not.toHaveBeenCalled();
  });
});
