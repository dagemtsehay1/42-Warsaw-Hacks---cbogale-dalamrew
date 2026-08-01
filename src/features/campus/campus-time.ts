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
