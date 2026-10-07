import { z } from "zod";

export type CatalogProject = { id: number; name: string; slug: string; available: boolean };

// Keep unknown/nested API fields, including fields 42 adds in future responses.
export const projectObjectSchema = z.object({
  id: z.number().int().positive(), name: z.string().min(1), slug: z.string().min(1),
}).passthrough();
export type ProjectObject = z.infer<typeof projectObjectSchema>;

const projectId = z.number().int().positive();
const milestoneSchema = z.object({
  required: z.array(projectId).max(100),
  alternatives: z.array(z.array(projectId).min(2, "Each choose-one group needs at least two projects.").max(100)).max(30),
});

export const pathsSchema = z.array(z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1, "Give every path a name.").max(100),
  milestones: z.array(milestoneSchema).length(7, "Every path must have milestones 0–6."),
})).min(1, "Keep at least one common core path.").max(50).superRefine((paths, ctx) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const path of paths) {
    if (ids.has(path.id) || names.has(path.name.toLowerCase())) {
      ctx.addIssue({ code: "custom", message: "Each path needs a unique name and ID." });
    }
    ids.add(path.id);
    names.add(path.name.toLowerCase());
    const projects = path.milestones.flatMap((milestone) => [
      ...milestone.required, ...milestone.alternatives.flat(),
    ]);
    if (new Set(projects).size !== projects.length) {
      ctx.addIssue({ code: "custom", message: `A project can only appear once in ${path.name}.` });
    }
  }
});

export type CommonCorePath = z.infer<typeof pathsSchema>[number];
export type Milestone = CommonCorePath["milestones"][number];
export type MilestoneSettings = { paths: CommonCorePath[]; version: number };

const storedProject = z.union([projectId, projectObjectSchema]);
const storedPathsSchema = z.array(z.object({
  id: z.string(), name: z.string(),
  milestones: z.array(z.object({
    required: z.array(storedProject), alternatives: z.array(z.array(storedProject)),
  })),
}));

/** The editor sends IDs; authoritative project objects are resolved server-side. */
export function editablePaths(stored: unknown): CommonCorePath[] {
  const id = (project: number | ProjectObject) => typeof project === "number" ? project : project.id;
  return pathsSchema.parse(storedPathsSchema.parse(stored).map((path) => ({
    ...path, milestones: path.milestones.map((m) => ({
      required: m.required.map(id), alternatives: m.alternatives.map((group) => group.map(id)),
    })),
  })));
}

export function snapshotPaths(paths: CommonCorePath[], catalog: Map<number, ProjectObject>) {
  const resolve = (id: number) => {
    const project = catalog.get(id);
    if (!project) throw new Error(`Missing project object for ${id}`);
    return project;
  };
  return paths.map((path) => ({
    ...path, milestones: path.milestones.map((m) => ({
      required: m.required.map(resolve), alternatives: m.alternatives.map((group) => group.map(resolve)),
    })),
  }));
}

/** Upgrade older ID-only assignments without changing already saved snapshots. */
export function backfillProjectSnapshots(stored: unknown, catalog: Map<number, ProjectObject>) {
  editablePaths(stored); // Validate the path constraints before upgrading.
  const resolve = (project: number | ProjectObject) => typeof project === "number" ? catalog.get(project) ?? project : project;
  return storedPathsSchema.parse(stored).map((path) => ({
    ...path, milestones: path.milestones.map((m) => ({
      required: m.required.map(resolve), alternatives: m.alternatives.map((group) => group.map(resolve)),
    })),
  }));
}

export function createPath(id: string, name: string): CommonCorePath {
  return { id, name, milestones: Array.from({ length: 7 }, () => ({ required: [], alternatives: [] })) };
}

export function assignedProjectIds(path: CommonCorePath): Set<number> {
  return new Set(path.milestones.flatMap((m) => [...m.required, ...m.alternatives.flat()]));
}

export function searchAvailableProjects(projects: CatalogProject[], assigned: Set<number>, search: string) {
  const term = search.trim().toLowerCase();
  return projects.filter((p) => p.available && !assigned.has(p.id) &&
    `${p.name} ${p.slug} ${p.id}`.toLowerCase().includes(term));
}
