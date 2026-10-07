import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withClient } from "@/lib/db/pool";
import { createPath, snapshotPaths, type ProjectObject } from "./config";
import { saveMilestoneSettings } from "./repository";

vi.mock("@/lib/db/pool", () => ({ withClient: vi.fn(), migrate: vi.fn(), query: vi.fn() }));
const dbQuery = vi.fn();
let current = { paths: [createPath("old", "Old")], version: 1 };
const project: ProjectObject = { id: 1, name: "libft", slug: "42cursus-libft", difficulty: 70, campus: [{ id: 67 }], project_sessions: [{ id: 42, solo: true }], extra_field: { nested: [1, null, "value"] } };
let catalog: { id: number; available: boolean; payload: ProjectObject | null }[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  current = { paths: [createPath("old", "Old")], version: 1 };
  catalog = [{ id: 1, available: true, payload: project }];
  dbQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE") ? [current] : sql.includes("FOR SHARE") ? catalog : [] }));
  vi.mocked(withClient).mockImplementation(async (fn) => fn({ query: dbQuery } as unknown as PoolClient));
});

describe("milestone persistence", () => {
  it("saves multiple paths atomically and increments the version", async () => {
    const path = createPath("old", "Old");
    path.milestones[0].required = [1];
    const next = createPath("new", "New");
    next.milestones[1].required = [1];
    expect(await saveMilestoneSettings([path, next], 1)).toBe(2);
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE milestone_settings"), [JSON.stringify(snapshotPaths([path, next], new Map([[1, project]])))]);
    expect(dbQuery).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects deleting every path before opening a transaction", async () => {
    await expect(saveMilestoneSettings([], 1)).rejects.toThrow("Keep at least one");
    expect(withClient).not.toHaveBeenCalled();
  });

  it("does not save partial project data while the catalog is being upgraded", async () => {
    const path = createPath("old", "Old");
    path.milestones[0].required = [1];
    catalog[0].payload = null;
    await expect(saveMilestoneSettings([path], 1)).rejects.toThrow("full project details");
    expect(dbQuery).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("rejects stale saves without overwriting another admin", async () => {
    current.version = 2;
    await expect(saveMilestoneSettings(current.paths, 1)).rejects.toThrow("Another admin");
    expect(dbQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(dbQuery).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE milestone_settings"), expect.anything());
  });

  it("rejects IDs outside the catalog and new assignments of unavailable projects", async () => {
    const path = createPath("old", "Old");
    path.milestones[0].required = [999];
    await expect(saveMilestoneSettings([path], 1)).rejects.toThrow("no longer available");
    path.milestones[0].required = [1];
    catalog[0].available = false;
    await expect(saveMilestoneSettings([path], 1)).rejects.toThrow("no longer available");
    current.paths[0].milestones[0].required = [1];
    expect(await saveMilestoneSettings([path], 1)).toBe(2);
  });
});
