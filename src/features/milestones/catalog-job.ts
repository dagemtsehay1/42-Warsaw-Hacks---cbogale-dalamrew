import { z } from "zod";
import { fortyTwoFetchAllPages } from "@/lib/api/42/client";
import { withClient } from "@/lib/db/pool";
import { backfillProjectSnapshots, projectObjectSchema, type ProjectObject } from "./config";

const catalogSchema = z.array(projectObjectSchema).min(1);

export async function runProjectCatalogJob(): Promise<{ projects: number }> {
  // Fetch every page and validate it before changing the previous good catalog.
  const projects = catalogSchema.parse(await fortyTwoFetchAllPages("/v2/projects", {
    pageSize: 100, maxPages: Infinity, searchParams: { sort: "id" },
  }));
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      // Use the same lock order as admin saves: settings, then catalog rows.
      const { rows: [settings] } = await client.query<{ paths: unknown }>(
        "SELECT paths FROM milestone_settings WHERE id = 1 FOR UPDATE",
      );
      await client.query("UPDATE project_catalog SET available = false WHERE available = true");
      await client.query(
        `INSERT INTO project_catalog (id, name, slug, available, payload)
         SELECT (p->>'id')::integer, p->>'name', p->>'slug', true, p
         FROM jsonb_array_elements($1::jsonb) AS p
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug,
           available = true, payload = EXCLUDED.payload, updated_at = now()`,
        [JSON.stringify(projects)],
      );
      if (settings) {
        const { rows: savedProjects } = await client.query<{ id: number; payload: ProjectObject }>(
          "SELECT id, payload FROM project_catalog WHERE payload IS NOT NULL",
        );
        const upgraded = backfillProjectSnapshots(settings.paths, new Map(savedProjects.map((p) => [p.id, p.payload])));
        // Compare JSONB in PostgreSQL: JSON object key ordering is immaterial.
        await client.query(
          `UPDATE milestone_settings SET paths = $1::jsonb, version = version + 1, updated_at = now()
           WHERE id = 1 AND paths IS DISTINCT FROM $1::jsonb`, [JSON.stringify(upgraded)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
  return { projects: projects.length };
}
