import { campusToday } from "@/features/campus/campus-time";
import { fetchAllMilestones } from "@/lib/api/pace/client";
import { hasDatabase, query, withClient } from "@/lib/db/pool";
import type { MilestoneStat } from "@/types/campus";

export function emptyMilestoneDistribution(): MilestoneStat[] {
  return Array.from({ length: 7 }, (_, milestone) => ({
    id: `milestone-${milestone}`,
    label: `Milestone ${milestone}`,
    milestone,
    studentCount: 0,
  }));
}

export async function milestonesAreDue(day = campusToday()): Promise<boolean> {
  const rows = await query<{ due: boolean }>(
    "SELECT NOT EXISTS (SELECT 1 FROM milestone_sync WHERE synced_for >= $1::date) AS due",
    [day],
  );
  return rows[0]?.due ?? true;
}

/** Called under the scheduler's advisory lock; raw rows and the day commit together. */
export async function runMilestoneSync(now = new Date()) {
  const day = campusToday(now);
  const items = await fetchAllMilestones();
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM student_milestones");
      await client.query(
        `INSERT INTO student_milestones (id, user_id, level, deadline, validated_at, payload)
         SELECT (item->>'id')::bigint, (item->>'user_id')::bigint,
                (item->>'level')::int, (item->>'deadline')::date,
                (item->>'validated_at')::date, item
           FROM jsonb_array_elements($1::jsonb) AS item`,
        [JSON.stringify(items)],
      );
      await client.query(
        `INSERT INTO milestone_sync (id, synced_for, synced_at) VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET synced_for = EXCLUDED.synced_for, synced_at = now()`,
        [day],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
  return { syncedFor: day, records: items.length, students: new Set(items.map((item) => item.user_id)).size };
}

/** Each user contributes only their highest milestone, regardless of API row order. */
export async function readMilestoneDistribution(): Promise<MilestoneStat[]> {
  const bands = emptyMilestoneDistribution();
  if (!hasDatabase()) return bands;
  try {
    const counts = await query<{ milestone: number; student_count: number }>(
      `SELECT milestone, count(*)::int AS student_count
         FROM (SELECT user_id, max(level) AS milestone
                 FROM student_milestones GROUP BY user_id) AS latest
        WHERE milestone BETWEEN 0 AND 6
        GROUP BY milestone`,
    );
    for (const row of counts) bands[row.milestone].studentCount = row.student_count;
  } catch (error) {
    console.error("[milestones] database read failed:", error);
  }
  return bands;
}
