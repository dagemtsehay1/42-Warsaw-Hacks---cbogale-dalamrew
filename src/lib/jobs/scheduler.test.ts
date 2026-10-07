import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { milestonesAreDue, runMilestoneSync } from "@/features/campus/milestones";
import { hasPaceCredentials } from "@/lib/api/pace/client";
import { runDueJobs } from "./scheduler";

const { locked, dbQuery } = vi.hoisted(() => ({ locked: vi.fn(), dbQuery: vi.fn() }));
vi.mock("@/lib/db/pool", () => ({
  hasDatabase: () => true, migrate: vi.fn(), query: dbQuery,
  withClient: async (fn: (client: unknown) => Promise<unknown>) => fn({ query: locked }),
}));
vi.mock("@/lib/api/42/config", () => ({ hasFortyTwoCredentials: () => false }));
vi.mock("@/lib/api/pace/client", () => ({ hasPaceCredentials: vi.fn() }));
vi.mock("@/features/campus/ingest", () => ({ runIngest: vi.fn() }));
vi.mock("@/features/campus/forecast-job", () => ({ hasForecastFor: vi.fn(), runForecastJob: vi.fn() }));
vi.mock("@/features/campus/milestones", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/campus/milestones")>(),
  runMilestoneSync: vi.fn(),
}));

let savedDay: string | null;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubEnv("CAMPUS_TIMEZONE", "Europe/Warsaw");
  vi.setSystemTime(new Date("2026-10-07T21:59:00Z"));
  vi.mocked(hasPaceCredentials).mockReturnValue(true);
  locked.mockResolvedValue({ rows: [{ locked: true }] });
  savedDay = null;
  dbQuery.mockImplementation(async (sql: string, params: string[]) => {
    if (sql.includes("milestone_sync")) return [{ due: savedDay === null || savedDay < params[0] }];
    return [{ id: "1" }];
  });
  vi.mocked(runMilestoneSync).mockImplementation(async () => {
    const { campusToday } = await import("@/features/campus/campus-time");
    savedDay = campusToday();
    return { syncedFor: savedDay, records: 0, students: 0 };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("daily milestone schedule", () => {
  it("runs on first boot, skips repeated ticks, and runs again at Warsaw midnight", async () => {
    await runDueJobs();
    await runDueJobs();
    expect(runMilestoneSync).toHaveBeenCalledTimes(1);
    expect(await milestonesAreDue()).toBe(false);
    vi.setSystemTime(new Date("2026-10-07T22:00:00Z"));
    await runDueJobs();
    await runDueJobs();
    expect(runMilestoneSync).toHaveBeenCalledTimes(2);
  });

  it("uses the saved day after a restart, including a successful empty snapshot", async () => {
    savedDay = "2026-10-07";
    await runDueJobs();
    expect(runMilestoneSync).not.toHaveBeenCalled();
  });

  it("retries an unsuccessful sync without marking the day complete", async () => {
    vi.mocked(runMilestoneSync).mockRejectedValueOnce(new Error("Pace unavailable"));
    await runDueJobs();
    await runDueJobs();
    expect(runMilestoneSync).toHaveBeenCalledTimes(2);
    expect(await milestonesAreDue()).toBe(false);
  });

  it("skips another instance's active job and skips unconfigured Pace access", async () => {
    locked.mockResolvedValueOnce({ rows: [{ locked: false }] });
    await runDueJobs();
    expect(runMilestoneSync).not.toHaveBeenCalled();
    vi.mocked(hasPaceCredentials).mockReturnValue(false);
    await runDueJobs();
    expect(runMilestoneSync).not.toHaveBeenCalled();
  });
});
