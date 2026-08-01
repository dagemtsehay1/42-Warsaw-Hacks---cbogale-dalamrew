import { startOfWeek } from "date-fns";
import { toSessionRecord } from "@/lib/api/42/transforms";
import type { FortyTwoLocation } from "@/lib/api/42/types";
import type { SessionRecord } from "@/types/campus";

/**
 * The Hall of Fame week runs Sunday → now, as asked for on the board.
 *
 * `date-fns` defaults to Monday, so the Sunday start is explicit. Like every
 * other boundary in this app (see `coalition-history.ts`) it is campus-local:
 * the server runs in the campus timezone, so tests must derive expected
 * timestamps through `startOfWeek` rather than hardcoding UTC strings — Warsaw's
 * Sunday starts at 22:00Z the day before.
 */
export function weekStart(now = new Date()): Date {
  return startOfWeek(now, { weekStartsOn: 0 });
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
