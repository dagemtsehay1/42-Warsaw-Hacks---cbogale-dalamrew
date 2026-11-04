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
             SELECT user_id, max(level) + 1 AS level
               FROM pace_milestones
              GROUP BY user_id
           ) AS latest
          WHERE level BETWEEN 1 AND 6
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

/** Match the roster used by the displayed snapshot, even between daily Pace syncs. */
export async function readMilestoneDistribution(milestoneStudentIds?: number[]): Promise<LevelBandStat[]> {
  // Older snapshots have no roster. Never fall back to the campus-wide Pace totals.
  if (!hasDatabase() || !milestoneStudentIds) return [];
  return query<LevelBandStat>(
    `WITH roster AS (
      SELECT DISTINCT unnest($1::bigint[]) AS user_id
     ), current_milestones AS (
      SELECT roster.user_id, max(pace.level) + 1 AS milestone
        FROM roster
        JOIN pace_milestones AS pace USING (user_id)
       GROUP BY roster.user_id
     ), counts AS (
      SELECT milestone AS level, count(*)::integer AS student_count
        FROM current_milestones
       WHERE milestone BETWEEN 1 AND 6
       GROUP BY milestone
     ), milestone_zero AS (
      SELECT greatest(
        0,
        (SELECT count(*) FROM roster) - coalesce((SELECT sum(student_count) FROM counts), 0)
      )::integer AS student_count
     )
     SELECT 'milestone-' || levels.level AS id,
            'Milestone ' || levels.level AS label,
            levels.level,
            CASE
              WHEN levels.level = 0 THEN (SELECT student_count FROM milestone_zero)
              ELSE coalesce(counts.student_count, 0)::integer
            END AS "studentCount"
       FROM generate_series(0, 6) AS levels(level)
       LEFT JOIN counts USING (level)
      ORDER BY levels.level`,
    [milestoneStudentIds],
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
