import { fetchLocationsSince } from "@/lib/api/42/resources";
import type { FortyTwoLocation } from "@/lib/api/42/types";
import { query } from "@/lib/db/pool";

/** How much history the forecast is fitted on. */
export const HISTORY_DAYS = 60;

/**
 * How far back each incremental sync re-reads. Sessions are written when they
 * open and updated when they close, so the window has to be wide enough to pick
 * up the `end_at` of anything still running at the previous sync — a couple of
 * days covers an overnight session and a missed run or two.
 */
const INCREMENTAL_DAYS = 3;

/** Rows older than this are dropped; the forecast never looks that far back. */
const RETENTION_DAYS = 75;

/** Rows per INSERT. Six parameters per row keeps this far under the 65k limit. */
const CHUNK = 500;

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Pulls host sessions into `location_sessions`.
 *
 * The first run backfills `HISTORY_DAYS` (Warsaw: ~7,500 sessions, ~75 pages,
 * about a minute at the paced rate limit); every run after that only re-reads
 * the last few days, which is 2–3 pages. Rows are keyed on the 42 location id,
 * so re-reading a window updates open sessions rather than duplicating them.
 */
export async function syncSessionHistory(campusId: number): Promise<{
  fetched: number;
  backfill: boolean;
}> {
  const [{ count }] = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM location_sessions",
  );
  const backfill = Number(count) === 0;

  const locations = await fetchLocationsSince(
    campusId,
    daysAgo(backfill ? HISTORY_DAYS : INCREMENTAL_DAYS).toISOString(),
    // ~100 sessions a page; a backfill needs the whole window, an incremental
    // sync only the tail.
    backfill ? 100 : 12,
  );

  await upsertSessions(campusId, locations);
  await query(
    `DELETE FROM location_sessions
      WHERE begin_at < now() - ($1 || ' days')::interval`,
    [String(RETENTION_DAYS)],
  );

  return { fetched: locations.length, backfill };
}

async function upsertSessions(campusId: number, locations: FortyTwoLocation[]) {
  for (let i = 0; i < locations.length; i += CHUNK) {
    const chunk = locations.slice(i, i + CHUNK);
    await query(
      `INSERT INTO location_sessions (id, campus_id, user_login, host, begin_at, end_at)
       SELECT * FROM unnest(
         $1::bigint[], $2::int[], $3::text[], $4::text[],
         $5::timestamptz[], $6::timestamptz[]
       )
       ON CONFLICT (id) DO UPDATE
         SET end_at = EXCLUDED.end_at,
             host = EXCLUDED.host,
             updated_at = now()`,
      [
        chunk.map((l) => l.id),
        chunk.map(() => campusId),
        chunk.map((l) => l.user.login),
        chunk.map((l) => l.host),
        chunk.map((l) => l.begin_at),
        chunk.map((l) => l.end_at),
      ],
    );
  }
}
