/**
 * Campus-local time. Day and hour boundaries on this board mean *Warsaw's*,
 * whatever timezone the server happens to run in — "how many people on Tuesday"
 * and "the busiest hour" are both meaningless otherwise.
 */
export function campusTimezone(): string {
  return process.env.CAMPUS_TIMEZONE?.trim() || "Europe/Warsaw";
}

/** Today in the campus's timezone, as `YYYY-MM-DD`. */
export function campusToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: campusTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The hour a campus "day" rolls over, for the parts of the board that describe
 * people rather than statistics.
 *
 * Midnight is the wrong boundary for "who got in first today": somebody who
 * badged in at 02:00 is finishing the previous day, not starting a new one, and
 * at midnight the board would crown them and then reset an hour later. 05:00 is
 * the quiet point — the overnight crowd has gone home and the early crowd
 * hasn't arrived.
 *
 * This is deliberately *not* used by the attendance forecast, which counts
 * calendar days: "how busy is Tuesday" means the whole of Tuesday.
 */
export const CAMPUS_DAY_START_HOUR = 5;

/**
 * Start of the campus day `now` falls in — 05:00 campus-local, not midnight.
 * Before 05:00 that is yesterday's 05:00, so the small hours still belong to the
 * day that is ending.
 */
export function campusDayStart(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(CAMPUS_DAY_START_HOUR, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}
