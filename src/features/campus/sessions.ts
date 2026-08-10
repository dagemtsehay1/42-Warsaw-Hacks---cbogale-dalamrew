import { startOfWeek } from "date-fns";
import { CAMPUS_DAY_START_HOUR } from "@/features/campus/campus-time";
import { toSessionRecord } from "@/lib/api/42/transforms";
import type { FortyTwoLocation } from "@/lib/api/42/types";
import type { SessionRecord } from "@/types/campus";

/**
 * The Hall of Fame week runs **Monday 05:00 → Monday 05:00**, campus-local.
 *
 * Both halves of that matter. Monday because the record should reset with the
 * working week rather than mid-weekend. 05:00 rather than midnight because the
 * long sessions this board exists to celebrate routinely run past midnight — a
 * boundary at 00:00 would cut Sunday night's marathon in half and hand the crown
 * to neither week.
 *
 * Like every other boundary in this app (see `coalition-history.ts`) it is
 * campus-local: the server runs in the campus timezone, so tests must derive
 * expected timestamps through `startOfWeek` rather than hardcoding UTC strings —
 * Warsaw's Monday 05:00 is 03:00Z in summer and 04:00Z in winter.
 */
export function weekStart(now = new Date()): Date {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  monday.setHours(CAMPUS_DAY_START_HOUR, 0, 0, 0);
  // Monday before 05:00 still belongs to the week that is ending.
  if (now < monday) monday.setDate(monday.getDate() - 7);
  return monday;
}

/**
 * The longest single session in the window.
 *
 * Open sessions are measured to `now`, so a student still sitting at a host can
 * take the crown mid-week — which is the point of the board. Ties go to the
 * session that started first, so the record doesn't flip between refreshes.
 */
export function pickTopSession(
  locations: FortyTwoLocation[],
  now = new Date(),
): SessionRecord | null {
  let best: SessionRecord | null = null;

  for (const location of locations) {
    const session = toSessionRecord(location, now);
    if (
      !best ||
      session.durationMs > best.durationMs ||
      (session.durationMs === best.durationMs &&
        new Date(session.beginAt) < new Date(best.beginAt))
    ) {
      best = session;
    }
  }

  return best;
}
