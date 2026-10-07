import { describe, expect, it } from "vitest";
import { assignedProjectIds, backfillProjectSnapshots, createPath, editablePaths, pathsSchema, searchAvailableProjects, snapshotPaths } from "./config";

describe("common core paths", () => {
  it("saves complete project objects in required tags and alternative groups and reopens them for editing", () => {
    const path = createPath("old", "Old");
    path.milestones[0].required = [1];
    path.milestones[5].alternatives = [[2, 3]];
    const projects = [1, 2, 3].map((id) => ({ id, name: `Project ${id}`, slug: `project-${id}`, cursus: [{ id: 21 }], new_field: { values: [true, null] } }));
    const catalog = new Map(projects.map((p) => [p.id, p]));
    const stored = snapshotPaths([path], catalog);
    expect(stored[0].milestones[0].required).toEqual([projects[0]]);
    expect(stored[0].milestones[5].alternatives).toEqual([[projects[1], projects[2]]]);
    expect(editablePaths(stored)).toEqual([path]);
    expect(editablePaths([path])).toEqual([path]);
    expect(backfillProjectSnapshots([path], catalog)).toEqual(stored);
    expect(backfillProjectSnapshots(stored, new Map())).toEqual(stored);
  });
  it("starts with seven independent empty milestones and requires at least one path", () => {
    const path = createPath("old", "Old common core");
    expect(path.milestones).toHaveLength(7);
    path.milestones[0].required.push(1);
    expect(path.milestones[1].required).toEqual([]);
    expect(pathsSchema.safeParse([]).success).toBe(false);
    expect(pathsSchema.safeParse([path]).success).toBe(true);
    path.milestones.pop();
    expect(pathsSchema.safeParse([path]).success).toBe(false);
  });

  it("rejects duplicates across required projects, groups, and milestones in one path", () => {
    const path = createPath("old", "Old common core");
    path.milestones[0].required = [1];
    path.milestones[5].alternatives = [[2, 3]];
    expect(pathsSchema.safeParse([path]).success).toBe(true);
    path.milestones[1].required = [1];
    expect(pathsSchema.safeParse([path]).success).toBe(false);
    path.milestones[1].required = [2];
    expect(pathsSchema.safeParse([path]).success).toBe(false);
  });

  it("allows reuse in different paths and rejects incomplete alternative groups", () => {
    const old = createPath("old", "Old common core");
    const next = createPath("new", "New common core");
    old.milestones[0].required = next.milestones[0].required = [1];
    expect(pathsSchema.safeParse([old, next]).success).toBe(true);
    next.milestones[5].alternatives = [[2]];
    expect(pathsSchema.safeParse([old, next]).success).toBe(false);
    next.milestones[5].alternatives = [[]];
    expect(pathsSchema.safeParse([old, next]).success).toBe(false);
  });

  it("requires distinct names and IDs", () => {
    expect(pathsSchema.safeParse([createPath("a", "Old"), createPath("b", " old ")]).success).toBe(false);
    expect(pathsSchema.safeParse([createPath("a", "Old"), createPath("a", "New")]).success).toBe(false);
  });

  it("searches names and slugs while hiding assigned and unavailable projects", () => {
    const path = createPath("old", "Old common core");
    path.milestones[0].required = [1];
    const projects = [
      { id: 1, name: "libft", slug: "42cursus-libft", available: true },
      { id: 2, name: "ft_printf", slug: "42cursus-ft_printf", available: true },
      { id: 3, name: "Old printf", slug: "old-printf", available: false },
    ];
    expect(searchAvailableProjects(projects, assignedProjectIds(path), "libft")).toEqual([]);
    expect(searchAvailableProjects(projects, assignedProjectIds(path), "PRINTF").map((p) => p.id)).toEqual([2]);
    path.milestones[0].required = [];
    expect(searchAvailableProjects(projects, assignedProjectIds(path), "42cursus-libft").map((p) => p.id)).toEqual([1]);
  });
});
