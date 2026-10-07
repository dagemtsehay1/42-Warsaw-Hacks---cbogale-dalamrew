import { migrate, query, withClient } from "@/lib/db/pool";
import { assignedProjectIds, editablePaths, pathsSchema, projectObjectSchema, snapshotPaths, type CatalogProject, type MilestoneSettings, type ProjectObject } from "./config";

export class MilestoneValidationError extends Error {}

export async function readMilestoneSettings(): Promise<MilestoneSettings> {
  await migrate();
  const [row] = await query<{ paths: unknown; version: number }>("SELECT paths, version FROM milestone_settings WHERE id = 1");
  return { paths: editablePaths(row.paths), version: row.version };
}

export async function readProjectCatalog(): Promise<{ projects: CatalogProject[]; syncedAt: string | null }> {
  const [projects, runs] = await Promise.all([
    query<CatalogProject>("SELECT id, name, slug, available FROM project_catalog ORDER BY lower(name), id"),
    query<{ synced_at: Date | null }>("SELECT max(finished_at) AS synced_at FROM job_runs WHERE job = 'project-catalog' AND status = 'success'"),
  ]);
  return { projects, syncedAt: runs[0]?.synced_at?.toISOString() ?? null };
}

export async function saveMilestoneSettings(input: unknown, version: number): Promise<number> {
  const parsed = pathsSchema.safeParse(input);
  if (!parsed.success) throw new MilestoneValidationError(parsed.error.issues[0].message);
  if (!Number.isInteger(version) || version < 1) throw new MilestoneValidationError("Invalid settings version. Reload the page.");
  await migrate();
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { rows: [current] } = await client.query<{ paths: unknown; version: number }>(
        "SELECT paths, version FROM milestone_settings WHERE id = 1 FOR UPDATE",
      );
      if (current.version !== version) throw new MilestoneValidationError("Another admin saved changes. Reload the page before editing again.");
      const selected = [...new Set(parsed.data.flatMap((path) => [...assignedProjectIds(path)]))];
      const { rows: projects } = await client.query<CatalogProject & { payload: ProjectObject | null }>(
        "SELECT id, name, slug, available, payload FROM project_catalog WHERE id = ANY($1::integer[]) FOR SHARE", [selected],
      );
      const catalog = new Map(projects.map((p) => [p.id, p]));
      const previousPaths = editablePaths(current.paths);
      for (const path of parsed.data) {
        const oldPath = previousPaths.find((p) => p.id === path.id);
        const previous = oldPath ? assignedProjectIds(oldPath) : new Set<number>();
        for (const id of assignedProjectIds(path)) {
          const project = catalog.get(id);
          if (!project || (!project.available && !previous.has(id))) {
            throw new MilestoneValidationError("A selected project is no longer available. Reload the page and choose another project.");
          }
          if (!project.payload) {
            throw new MilestoneValidationError("The project catalog is updating its full project details. Please try saving again after the sync finishes.");
          }
        }
      }
      const snapshots = new Map(projects.map((p) => [p.id, projectObjectSchema.parse(p.payload)]));
      await client.query(
        "UPDATE milestone_settings SET paths = $1::jsonb, version = version + 1, updated_at = now() WHERE id = 1",
        [JSON.stringify(snapshotPaths(parsed.data, snapshots))],
      );
      await client.query("COMMIT");
      return version + 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
