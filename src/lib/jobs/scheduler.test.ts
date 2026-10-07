import type { PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query, withClient } from "@/lib/db/pool";
import { hasForecastFor, runForecastJob } from "@/features/campus/forecast-job";
import { runIngest } from "@/features/campus/ingest";
import { runProjectCatalogJob } from "@/features/milestones/catalog-job";
import { runDueJobs } from "./scheduler";

vi.mock("@/lib/db/pool", () => ({ query: vi.fn(), withClient: vi.fn(), hasDatabase: vi.fn(), migrate: vi.fn() }));
vi.mock("@/features/campus/forecast-job", () => ({ hasForecastFor: vi.fn(), runForecastJob: vi.fn() }));
vi.mock("@/features/campus/ingest", () => ({ runIngest: vi.fn() }));
vi.mock("@/features/milestones/catalog-job", () => ({ runProjectCatalogJob: vi.fn() }));
const dbQuery = vi.fn();
let catalogDue = true;

beforeEach(() => {
  vi.resetAllMocks();
  catalogDue = true;
  dbQuery.mockResolvedValue({ rows: [{ locked: true }] });
  vi.mocked(withClient).mockImplementation(async (fn) => fn({ query: dbQuery } as unknown as PoolClient));
  vi.mocked(query).mockImplementation(async (sql) => {
    if (sql.includes("AS due")) return [{ due: sql.includes("project-catalog") ? catalogDue : false }];
    if (sql.includes("INSERT INTO job_runs")) return [{ id: "1" }];
    return [];
  });
  vi.mocked(hasForecastFor).mockResolvedValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("weekly project catalog schedule", () => {
  it("runs due catalog refreshes and records success", async () => {
    vi.mocked(runProjectCatalogJob).mockResolvedValue({ projects: 42 });
    await runDueJobs();
    expect(runProjectCatalogJob).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'success'"), ["1", '{"projects":42}']);
    expect(runIngest).not.toHaveBeenCalled();
    expect(dbQuery).toHaveBeenLastCalledWith("SELECT pg_advisory_unlock($1)", expect.any(Array));
  });

  it("skips a fresh catalog or a retry in its cooldown", async () => {
    catalogDue = false;
    await runDueJobs();
    expect(runProjectCatalogJob).not.toHaveBeenCalled();
  });

  it("records a catalog failure and still runs other due jobs", async () => {
    vi.mocked(runProjectCatalogJob).mockRejectedValue(new Error("API unavailable"));
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
    expect(runProjectCatalogJob).not.toHaveBeenCalled();
  });
});
