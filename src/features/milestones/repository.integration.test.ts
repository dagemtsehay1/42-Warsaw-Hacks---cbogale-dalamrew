import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client, type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasDatabase, query, withClient } from "@/lib/db/pool";
import type { PaceMilestone } from "./client";
import { hasMilestonesFor, readMilestoneDistribution, saveMilestones } from "./repository";

vi.mock("@/lib/db/pool", () => ({ hasDatabase: vi.fn(), query: vi.fn(), withClient: vi.fn() }));

// Optional real SQL coverage. Only connection-local temporary tables are used;
// no existing tables or records are modified, even on a development database.
describe.skipIf(!process.env.MILESTONES_TEST_DATABASE_URL)("milestone Postgres integration", () => {
  let client: Client;
  const record = (id: number, user: number, level: number): PaceMilestone => ({
    id, user_id: user, level, deadline: "2026-10-20", validated_at: null,
  });

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.MILESTONES_TEST_DATABASE_URL, connectionTimeoutMillis: 5000 });
    await client.connect();
    const schema = await readFile(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
    for (const table of ["pace_milestones", "milestone_counts", "milestone_sync"]) {
      const ddl = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))?.[0];
      if (!ddl) throw new Error(`Missing schema definition for ${table}`);
      await client.query(ddl.replace("CREATE TABLE IF NOT EXISTS", "CREATE TEMP TABLE"));
    }
    vi.mocked(hasDatabase).mockReturnValue(true);
    vi.mocked(withClient).mockImplementation(async (fn) => fn(client as unknown as PoolClient));
    vi.mocked(query).mockImplementation(async (sql, params) => (await client.query(sql, params)).rows);
  });
  beforeEach(async () => {
    for (const table of ["pace_milestones", "milestone_counts", "milestone_sync"]) {
      await client.query(`DELETE FROM pg_temp.${table}`);
    }
  });
  afterAll(async () => { await client?.end(); });

  it("counts each user at their newest record regardless of page order, validation or maximum level", async () => {
    const records = [record(30, 12, 2), record(10, 12, 0), record(20, 12, 1),
      record(40, 13, 4), record(50, 13, 1), record(60, 14, 2)];
    await saveMilestones(records, "2026-10-08");
    const rows = await readMilestoneDistribution();
    expect(rows.map((row) => row.studentCount)).toEqual([0, 1, 2, 0, 0, 0, 0]);
    expect(rows[2].label).toBe("Milestone 2");
    expect((await client.query("SELECT count(*)::int AS count FROM pg_temp.pace_milestones")).rows[0].count).toBe(6);
    expect(await hasMilestonesFor("2026-10-08")).toBe(true);
    expect(await hasMilestonesFor("2026-10-09")).toBe(false);
  });

  it("is idempotent and removes stale records and counts on a complete replacement", async () => {
    await saveMilestones([record(1, 12, 2), record(2, 13, 3)], "2026-10-08");
    await saveMilestones([record(3, 12, 8)], "2026-10-09");
    await saveMilestones([record(3, 12, 8)], "2026-10-09");
    const rows = await readMilestoneDistribution();
    expect(rows).toHaveLength(9);
    expect(rows.filter((row) => row.studentCount > 0)).toEqual([{ id: "milestone-8", label: "Milestone 8", level: 8, studentCount: 1 }]);
    expect((await client.query("SELECT count(*)::int AS count FROM pg_temp.pace_milestones")).rows[0].count).toBe(1);
  });

  it("retains the previous raw records, counts and sync date when count insertion fails", async () => {
    await saveMilestones([record(1, 12, 2)], "2026-10-08");
    await client.query("ALTER TABLE pg_temp.milestone_counts ADD CONSTRAINT test_failure CHECK (student_count < 2)");
    try {
      await expect(saveMilestones([record(2, 13, 3), record(3, 14, 3)], "2026-10-09")).rejects.toThrow();
      expect((await readMilestoneDistribution()).filter((row) => row.studentCount)).toEqual([{ id: "milestone-2", label: "Milestone 2", level: 2, studentCount: 1 }]);
      expect((await client.query("SELECT payload FROM pg_temp.pace_milestones")).rows).toEqual([{ payload: record(1, 12, 2) }]);
      expect(await hasMilestonesFor("2026-10-09")).toBe(false);
    } finally {
      await client.query("ALTER TABLE pg_temp.milestone_counts DROP CONSTRAINT test_failure");
    }
  });

  it("replaces previous data with a successful empty feed and records its sync date", async () => {
    await saveMilestones([record(1, 12, 2)], "2026-10-08");
    await saveMilestones([], "2026-10-09");
    expect((await readMilestoneDistribution()).every((row) => row.studentCount === 0)).toBe(true);
    expect(await hasMilestonesFor("2026-10-09")).toBe(true);
  });
});
