import type { PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query, withClient } from "@/lib/db/pool";
import { hasForecastFor, runForecastJob } from "@/features/campus/forecast-job";
import { runIngest } from "@/features/campus/ingest";
import { hasFortyTwoCredentials } from "@/lib/api/42/config";
import { hasPaceCredentials } from "@/features/milestones/config";
import { hasMilestonesFor, runMilestoneSync } from "@/features/milestones/repository";
import { hasDatabase, migrate } from "@/lib/db/pool";
import { runDueJobs, startScheduler } from "./scheduler";

vi.mock("@/lib/db/pool", () => ({ query: vi.fn(), withClient: vi.fn(), hasDatabase: vi.fn(), migrate: vi.fn() }));
vi.mock("@/features/campus/forecast-job", () => ({ hasForecastFor: vi.fn(), runForecastJob: vi.fn() }));
vi.mock("@/features/campus/ingest", () => ({ runIngest: vi.fn() }));
vi.mock("@/lib/api/42/config", () => ({ hasFortyTwoCredentials: vi.fn() }));
vi.mock("@/features/milestones/config", () => ({ hasPaceCredentials: vi.fn() }));
vi.mock("@/features/milestones/repository", () => ({ hasMilestonesFor: vi.fn(), runMilestoneSync: vi.fn() }));
const dbQuery = vi.fn();
let ingestDue = true;

beforeEach(() => {
  vi.resetAllMocks();
  ingestDue = true;
  vi.mocked(hasFortyTwoCredentials).mockReturnValue(true);
  vi.mocked(hasPaceCredentials).mockReturnValue(true);
  vi.mocked(hasMilestonesFor).mockResolvedValue(true);
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
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

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
    expect(runMilestoneSync).not.toHaveBeenCalled();
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
    expect(runMilestoneSync).not.toHaveBeenCalled();
  });

  it("syncs milestones on first startup before ingest", async () => {
    vi.mocked(hasMilestonesFor).mockResolvedValue(false);
    await runDueJobs();
    expect(runMilestoneSync).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO job_runs"), ["milestones"]);
    expect(vi.mocked(runMilestoneSync).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runIngest).mock.invocationCallOrder[0]);
  });

  it("becomes due at Warsaw midnight and skips the next tick after success", async () => {
    vi.useFakeTimers();
    vi.stubEnv("CAMPUS_TIMEZONE", "Europe/Warsaw");
    let syncedFor = "2026-10-08";
    vi.mocked(hasMilestonesFor).mockImplementation(async (day) => day === syncedFor);
    vi.mocked(runMilestoneSync).mockImplementation(async () => {
      syncedFor = "2026-10-09";
      return { syncedFor, records: 3, students: 1 };
    });
    vi.setSystemTime(new Date("2026-10-08T21:59:59Z"));
    await runDueJobs();
    expect(runMilestoneSync).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-08T22:00:00Z"));
    await runDueJobs();
    await runDueJobs();
    expect(runMilestoneSync).toHaveBeenCalledOnce();
    expect(hasMilestonesFor).toHaveBeenLastCalledWith("2026-10-09");
  });

  it("retries failed milestone syncs without blocking the other jobs", async () => {
    vi.mocked(hasMilestonesFor).mockResolvedValue(false);
    vi.mocked(runMilestoneSync).mockRejectedValueOnce(new Error("Pace unavailable"));
    await runDueJobs();
    expect(runIngest).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"), ["1", '{"error":"Pace unavailable"}']);
    await runDueJobs();
    expect(runMilestoneSync).toHaveBeenCalledTimes(2);
  });

  it("skips Pace when its credentials are missing", async () => {
    vi.mocked(hasPaceCredentials).mockReturnValue(false);
    await runDueJobs();
    expect(hasMilestonesFor).not.toHaveBeenCalled();
    expect(runMilestoneSync).not.toHaveBeenCalled();
    expect(runIngest).toHaveBeenCalledOnce();
  });

  it("starts and syncs with only Pace credentials configured", async () => {
    vi.useFakeTimers();
    vi.mocked(hasDatabase).mockReturnValue(true);
    vi.mocked(hasFortyTwoCredentials).mockReturnValue(false);
    vi.mocked(hasMilestonesFor).mockResolvedValue(false);
    startScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(migrate).toHaveBeenCalledOnce();
    expect(runMilestoneSync).toHaveBeenCalledOnce();
    expect(runIngest).not.toHaveBeenCalled();
    expect(runForecastJob).not.toHaveBeenCalled();
    vi.clearAllTimers();
  });
});
