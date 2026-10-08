import type { PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasDatabase, query, withClient } from "@/lib/db/pool";
import type { DashboardPayload } from "@/types/campus";
import { fetchAllMilestones } from "./client";
import { hasMilestonesFor, readMilestoneDistribution, runMilestoneSync, saveMilestones, withMilestoneStats } from "./repository";

vi.mock("@/lib/db/pool", () => ({ hasDatabase: vi.fn(), query: vi.fn(), withClient: vi.fn() }));
vi.mock("./client", () => ({ fetchAllMilestones: vi.fn() }));
const dbQuery = vi.fn();
const items = [
  { id: 1, user_id: 12, level: 0, deadline: "2026-07-02", validated_at: "2026-06-28" },
  { id: 2, user_id: 12, level: 1, deadline: "2026-08-02", validated_at: "2026-07-28" },
  { id: 3, user_id: 12, level: 2, deadline: "2026-09-02", validated_at: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(hasDatabase).mockReturnValue(true);
  vi.mocked(withClient).mockImplementation(async (fn) => fn({ query: dbQuery } as unknown as PoolClient));
  dbQuery.mockResolvedValue({ rows: [] });
  vi.mocked(fetchAllMilestones).mockResolvedValue(items);
});
afterEach(() => vi.unstubAllEnvs());

describe("milestone persistence", () => {
  it("publishes raw records and counts in one transaction, with the daily marker last", async () => {
    await saveMilestones(items, "2026-10-08");
    expect(dbQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(dbQuery.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    const raw = dbQuery.mock.calls.findIndex(([sql]) => sql.includes("INSERT INTO pace_milestones"));
    const counts = dbQuery.mock.calls.findIndex(([sql]) => sql.includes("INSERT INTO milestone_counts"));
    const marker = dbQuery.mock.calls.findIndex(([sql]) => sql.includes("INSERT INTO milestone_sync"));
    expect(raw).toBeLessThan(counts);
    expect(counts).toBeLessThan(marker);
    expect(dbQuery.mock.calls[raw][1]).toEqual([JSON.stringify(items)]);
    expect(dbQuery.mock.calls[marker][1]).toEqual(["2026-10-08", 3]);
  });

  it("rolls back raw rows and counts when aggregation fails", async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO milestone_counts")) throw new Error("write failed");
      return { rows: [] };
    });
    await expect(saveMilestones(items, "2026-10-08")).rejects.toThrow("write failed");
    expect(dbQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(dbQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(dbQuery.mock.calls.some(([sql]) => sql.includes("INSERT INTO milestone_sync"))).toBe(false);
  });

  it("never opens a write transaction if any page fails", async () => {
    vi.mocked(fetchAllMilestones).mockRejectedValue(new Error("page 48 failed"));
    await expect(runMilestoneSync()).rejects.toThrow("page 48 failed");
    expect(withClient).not.toHaveBeenCalled();
  });

  it("reports distinct users and saves the campus-local sync day", async () => {
    vi.stubEnv("CAMPUS_TIMEZONE", "Europe/Warsaw");
    expect(await runMilestoneSync(new Date("2026-10-08T22:01:00Z"))).toEqual({ syncedFor: "2026-10-09", records: 3, students: 1 });
  });

  it("marks a complete empty response as successfully synced", async () => {
    vi.mocked(fetchAllMilestones).mockResolvedValue([]);
    expect(await runMilestoneSync()).toMatchObject({ records: 0, students: 0 });
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO milestone_sync"), [expect.any(String), 0]);
    expect(dbQuery).toHaveBeenLastCalledWith("COMMIT");
  });

  it("uses persisted daily state across restarts", async () => {
    vi.mocked(query).mockResolvedValueOnce([{ exists: false }]).mockResolvedValueOnce([{ exists: true }]);
    expect(await hasMilestonesFor("2026-10-08")).toBe(false);
    expect(await hasMilestonesFor("2026-10-08")).toBe(true);
  });

  it("does not try to read Postgres without a database", async () => {
    vi.mocked(hasDatabase).mockReturnValue(false);
    expect(await readMilestoneDistribution()).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("dashboard milestone data", () => {
  const previous = {
    stats: { averageLevel: 8.4, topLevel: 19, studentsInCursus: 10 },
    levelDistribution: [{ id: "lvl-3", level: 3, label: "Level 3", studentCount: 10 }],
  } as DashboardPayload;

  it("replaces old level snapshots with weighted milestone counts without altering other stats", () => {
    const bands = [
      { id: "milestone-0", level: 0, label: "Milestone 0", studentCount: 1 },
      { id: "milestone-2", level: 2, label: "Milestone 2", studentCount: 3 },
      { id: "milestone-6", level: 6, label: "Milestone 6", studentCount: 0 },
    ];
    const next = withMilestoneStats(previous, bands);
    expect(next.levelDistribution).toEqual(bands);
    expect(next.stats).toEqual({ averageLevel: 1.5, topLevel: 2, studentsInCursus: 10 });
    expect(previous.stats.averageLevel).toBe(8.4);
  });

  it("does not label legacy levels as milestones when milestone data is unavailable", () => {
    const next = withMilestoneStats(previous, []);
    expect(next.levelDistribution).toEqual([]);
    expect(next.stats.averageLevel).toBe(0);
    expect(next.stats.topLevel).toBe(0);
  });
});
