import { buildDashboardPayload } from "@/features/campus/dashboard-service";
import { syncCampusEvents } from "@/features/campus/events";
import { syncSessionHistory } from "@/features/campus/session-history";
import { mergeSnapshotWithPrevious } from "@/features/campus/snapshot-merge";
import { pruneTeammateRequests } from "@/features/teammates/repository";
import { query } from "@/lib/db/pool";
import type { DashboardPayload } from "@/types/campus";

async function readLatestPayload(): Promise<DashboardPayload | null> {
  const rows = await query<{ payload: DashboardPayload }>(
    "SELECT payload FROM dashboard_snapshots ORDER BY captured_at DESC LIMIT 1",
  );
  return rows[0]?.payload ?? null;
}

/** Snapshots kept: a day of history at the 30-minute cadence. */
const KEEP_SNAPSHOTS = 48;

/**
 * The only place the 42 API is called on a schedule.
 *
 * It builds the whole payload first and writes it in one statement, so a failure
 * anywhere in the 42 API leaves the previous snapshot untouched and the board
 * keeps serving the last good data. Nothing on the request path ever calls the
 * 42 API, which is what makes the display survive an outage.
 */
export async function runIngest(): Promise<{
  campusId: number;
  capturedAt: string;
  softErrors: string[];
  sessions: { fetched: number; backfill: boolean };
  events: number;
  prunedTeammates: number;
}> {
  const fresh: DashboardPayload = await buildDashboardPayload();

  // A payload built without credentials is the zeroed mock; storing it would
  // overwrite real data with placeholders.
  if (fresh.errors.includes("42 API credentials are not configured")) {
    throw new Error("42 API credentials are not configured");
  }

  // Sections that soft-failed keep their last known value rather than going
  // blank on the wall — see `snapshot-merge.ts` for what is and isn't carried.
  const payload = mergeSnapshotWithPrevious(fresh, await readLatestPayload());

  const rows = await query<{ captured_at: string }>(
    `INSERT INTO dashboard_snapshots (campus_id, payload)
     VALUES ($1, $2)
     RETURNING to_char(captured_at, 'YYYY-MM-DD"T"HH24:MI:SS.MSOF') AS captured_at`,
    [payload.campusId, JSON.stringify(payload)],
  );

  await query(
    `DELETE FROM dashboard_snapshots
      WHERE id NOT IN (
        SELECT id FROM dashboard_snapshots ORDER BY captured_at DESC LIMIT $1
      )`,
    [KEEP_SNAPSHOTS],
  );

  // Session history feeds the forecast, not the board, so a failure here must
  // not throw away the snapshot that was just written.
  let sessions = { fetched: 0, backfill: false };
  try {
    sessions = await syncSessionHistory(payload.campusId);
  } catch (error) {
    payload.errors.push(`Session history: ${String(error)}`);
  }

  // Same reasoning: events live in their own table and the board reads them
  // directly, so a failed events fetch costs this week's event screen and
  // nothing else.
  let events = 0;
  try {
    events = await syncCampusEvents(payload.campusId);
  } catch (error) {
    payload.errors.push(`Events: ${String(error)}`);
  }

  let pruned = 0;
  try {
    pruned = await pruneTeammateRequests();
  } catch (error) {
    payload.errors.push(`Teammate cleanup: ${String(error)}`);
  }

  return {
    campusId: payload.campusId,
    capturedAt: rows[0]?.captured_at ?? new Date().toISOString(),
    softErrors: payload.errors,
    sessions,
    events,
    prunedTeammates: pruned,
  };
}
