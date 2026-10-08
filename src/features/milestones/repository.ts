import { campusToday } from "@/features/campus/campus-time";
import { hasDatabase, query, withClient } from "@/lib/db/pool";
import type { DashboardPayload, LevelBandStat } from "@/types/campus";
import { fetchAllMilestones, type PaceMilestone } from "./client";

export async function hasMilestonesFor(day: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM milestone_sync WHERE id = 1 AND synced_for >= $1::date) AS exists",
    [day],
  );
  return rows[0]?.exists ?? false;
}

/** All raw records and derived totals become visible together, after all pages succeed. */
export async function saveMilestones(items: PaceMilestone[], day: string): Promise<void> {
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM pace_milestones");
      await client.query(
        `INSERT INTO pace_milestones (id, user_id, level, deadline, validated_at, payload)
         SELECT (item->>'id')::bigint, (item->>'user_id')::bigint,
                (item->>'level')::integer, (item->>'deadline')::date,
                (item->>'validated_at')::date, item
           FROM jsonb_array_elements($1::jsonb) AS item`,
        [JSON.stringify(items)],
      );
      await client.query("DELETE FROM milestone_counts");
      // The feed has no created_at: the highest record id identifies the newest
      // milestone, including a current milestone that has not been validated.
      await client.query(
        `INSERT INTO milestone_counts (level, student_count)
         SELECT level, count(*)::integer
           FROM (
             SELECT DISTINCT ON (user_id) user_id, level
               FROM pace_milestones
              ORDER BY user_id, id DESC
           ) AS latest
          GROUP BY level`,
      );
      await client.query(
        `INSERT INTO milestone_sync (id, synced_for, record_count, synced_at)
         VALUES (1, $1, $2, now())
         ON CONFLICT (id) DO UPDATE SET synced_for = EXCLUDED.synced_for,
           record_count = EXCLUDED.record_count, synced_at = EXCLUDED.synced_at`,
        [day, items.length],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function runMilestoneSync(now = new Date()) {
  const day = campusToday(now);
  const items = await fetchAllMilestones();
  await saveMilestones(items, day);
  return { syncedFor: day, records: items.length, students: new Set(items.map((item) => item.user_id)).size };
}

export async function readMilestoneDistribution(): Promise<LevelBandStat[]> {
  if (!hasDatabase()) return [];
  return query<LevelBandStat>(
    `SELECT 'milestone-' || levels.level AS id,
            'Milestone ' || levels.level AS label,
            levels.level, coalesce(counts.student_count, 0)::integer AS "studentCount"
       FROM generate_series(0, greatest(6, (SELECT max(level) FROM milestone_counts))) AS levels(level)
       LEFT JOIN milestone_counts AS counts USING (level)
      ORDER BY levels.level`,
  );
}

/** Retain the chart's existing payload shape while replacing its data source. */
export function withMilestoneStats(payload: DashboardPayload, bands: LevelBandStat[]): DashboardPayload {
  const students = bands.reduce((sum, band) => sum + band.studentCount, 0);
  const weighted = bands.reduce((sum, band) => sum + band.level * band.studentCount, 0);
  return {
    ...payload,
    levelDistribution: bands,
    stats: {
      ...payload.stats,
      averageLevel: students ? weighted / students : 0,
      topLevel: bands.reduce((top, band) => band.studentCount ? Math.max(top, band.level) : top, 0),
    },
  };
}
