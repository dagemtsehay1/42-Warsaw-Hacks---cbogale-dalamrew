/**
 * Attendance forecasting from host-session history.
 *
 * The 42 API has no "how many people will be here" endpoint, so the numbers on
 * the board are fitted from the campus's own past: `location_sessions` holds
 * ~60 days of host sessions, which is 8–9 observations of every weekday.
 *
 * The estimator is deliberately robust rather than clever:
 *
 * 1. **Same weekday only.** Tuesday looks nothing like Sunday at 42; pooling
 *    weekdays is the single biggest source of error.
 * 2. **Weighted median, not mean.** One public holiday or one exam day would
 *    drag a mean by 20%; the median ignores it. Weights decay 0.8 per week back,
 *    so a month-old Tuesday counts about half as much as last Tuesday.
 * 3. **Trend adjustment.** Piscines, exam weeks and the summer dip move the
 *    whole campus at once, which a weekday median reacts to a week late. The
 *    ratio of the last 14 days to the 14 before them corrects for that, clamped
 *    to ±15% so a single quiet week can't run away with the estimate.
 * 4. **A range, not just a point.** The weighted quartiles of the same samples
 *    become the low/high hint, so the board shows how confident it isn't.
 *
 * What it cannot know: public holidays, exam days, and campus events. Those are
 * not in any 42 endpoint, so a holiday Tuesday will be forecast as a normal one.
 */

/** Distinct students seen on campus on one campus-local day. */
export type DailyAttendance = { date: string; students: number };

/** Distinct students on campus during one hour of one campus-local day. */
export type HourlyLoad = { date: string; hour: number; students: number };

export type AttendanceForecast = {
  targetDate: string;
  expected: number;
  low: number;
  high: number;
  peakHour: number | null;
  peakStudents: number | null;
  /** How many same-weekday observations the estimate is built from. */
  sampleDays: number;
};

/** Same-weekday observations considered, newest first. */
const MAX_SAMPLES = 8;
/** Weight decay per week back. */
const DECAY = 0.8;
/** Days per trend window. */
const TREND_WINDOW = 14;
const TREND_CLAMP = 0.15;

/** Parses a `YYYY-MM-DD` day to its weekday, free of the server's timezone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

/** `YYYY-MM-DD` + n days, again timezone-free. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weighted quantile of (value, weight) pairs; `q` in 0..1. */
function weightedQuantile(
  pairs: { value: number; weight: number }[],
  q: number,
): number {
  if (pairs.length === 0) return 0;
  const sorted = [...pairs].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return sorted[Math.floor(sorted.length / 2)].value;

  let seen = 0;
  for (const pair of sorted) {
    seen += pair.weight;
    if (seen >= total * q) return pair.value;
  }
  return sorted[sorted.length - 1].value;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * How much busier (or quieter) the campus is right now than a fortnight ago.
 *
 * Compared **within each weekday** and then taken as a median across weekdays:
 * a plain 14-day-vs-14-day mean shifts whenever the two windows hold different
 * weekdays (one missing Tuesday and a flat campus reads as a 3% decline), which
 * would leak into every forecast. Returns 1 when the history can't tell.
 */
export function trendFactor(history: DailyAttendance[], today: string): number {
  const recent = new Map<number, number[]>();
  const previous = new Map<number, number[]>();

  for (const day of history) {
    if (day.date >= today || day.students <= 0) continue;
    const age = daysBetween(day.date, today);
    const bucket =
      age <= TREND_WINDOW
        ? recent
        : age <= TREND_WINDOW * 2
          ? previous
          : null;
    if (!bucket) continue;
    bucket.set(weekdayOf(day.date), [
      ...(bucket.get(weekdayOf(day.date)) ?? []),
      day.students,
    ]);
  }

  const ratios: number[] = [];
  for (const [weekday, values] of recent) {
    const before = previous.get(weekday);
    if (!before?.length || !values.length) continue;
    const base = mean(before);
    if (base > 0) ratios.push(mean(values) / base);
  }
  if (ratios.length < 3) return 1;

  const median = weightedQuantile(
    ratios.map((value) => ({ value, weight: 1 })),
    0.5,
  );
  return Math.min(1 + TREND_CLAMP, Math.max(1 - TREND_CLAMP, median));
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00.000Z`).getTime();
  const b = new Date(`${to}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * The hour of the day the campus is fullest, as the median across the same
 * weekday's history. Ties go to the earlier hour.
 */
function peakHourFor(
  hourly: HourlyLoad[],
  sampleDates: Set<string>,
): { hour: number; students: number } | null {
  const byHour = new Map<number, number[]>();

  for (const row of hourly) {
    if (!sampleDates.has(row.date)) continue;
    const bucket = byHour.get(row.hour) ?? [];
    bucket.push(row.students);
    byHour.set(row.hour, bucket);
  }
  if (byHour.size === 0) return null;

  let best: { hour: number; students: number } | null = null;
  for (const [hour, values] of [...byHour].sort((a, b) => a[0] - b[0])) {
    const median = weightedQuantile(
      values.map((value) => ({ value, weight: 1 })),
      0.5,
    );
    if (!best || median > best.students) best = { hour, students: median };
  }
  return best;
}

/**
 * The estimate for one future day.
 *
 * `today` is the campus-local day the forecast is computed on; only strictly
 * earlier days are used as evidence, so re-running mid-day cannot change it.
 */
export function forecastAttendance(
  history: DailyAttendance[],
  hourly: HourlyLoad[],
  targetDate: string,
  today: string,
  /** Exposed so the estimator can be swept against real history; see the README. */
  options: { decay?: number; maxSamples?: number } = {},
): AttendanceForecast | null {
  const decay = options.decay ?? DECAY;
  const weekday = weekdayOf(targetDate);
  const samples = history
    .filter((day) => day.date < today && weekdayOf(day.date) === weekday)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, options.maxSamples ?? MAX_SAMPLES);

  if (samples.length === 0) return null;

  const weighted = samples.map((day, index) => ({
    value: day.students,
    weight: decay ** index,
  }));

  const trend = trendFactor(history, today);
  const scale = (value: number) => Math.max(0, Math.round(value * trend));
  const peak = peakHourFor(hourly, new Set(samples.map((s) => s.date)));

  return {
    targetDate,
    expected: scale(weightedQuantile(weighted, 0.5)),
    low: scale(weightedQuantile(weighted, 0.25)),
    high: scale(weightedQuantile(weighted, 0.75)),
    peakHour: peak?.hour ?? null,
    peakStudents: peak ? scale(peak.students) : null,
    sampleDays: samples.length,
  };
}

/**
 * The board's outlook: today (for the peak-hour tile) plus the next three days.
 */
export function buildOutlook(
  history: DailyAttendance[],
  hourly: HourlyLoad[],
  today: string,
): AttendanceForecast[] {
  return [0, 1, 2, 3]
    .map((offset) =>
      forecastAttendance(history, hourly, addDays(today, offset), today),
    )
    .filter((forecast): forecast is AttendanceForecast => forecast != null);
}
