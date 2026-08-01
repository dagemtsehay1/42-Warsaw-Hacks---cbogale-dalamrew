import {
  buildOutlook,
  type DailyAttendance,
  type HourlyLoad,
} from "@/features/campus/attendance-forecast";
import { campusTimezone, campusToday } from "@/features/campus/campus-time";
import { HISTORY_DAYS } from "@/features/campus/session-history";
import { query } from "@/lib/db/pool";

/** Distinct students per campus-local day. */
async function readDailyAttendance(): Promise<DailyAttendance[]> {
  const rows = await query<{ date: string; students: number }>(
    `SELECT to_char((begin_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS date,
            count(DISTINCT user_login)::int AS students
       FROM location_sessions
      WHERE begin_at >= now() - ($2 || ' days')::interval
      GROUP BY 1
      ORDER BY 1`,
    [campusTimezone(), String(HISTORY_DAYS)],
  );
  return rows;
}

/**
 * Distinct students on campus during each hour, per day.
 *
 * A session is expanded over every hour it touches, so this measures *presence*
 * rather than logins — the busiest hour is when the most people are in the
 * building, not when the most people badged in. Sessions longer than a day are
 * dropped: they are forgotten logouts, and expanding one would flatten the
 * whole profile.
 */
async function readHourlyLoad(): Promise<HourlyLoad[]> {
  const rows = await query<{ date: string; hour: number; students: number }>(
    `WITH bounded AS (
       SELECT user_login,
              (begin_at AT TIME ZONE $1) AS starts,
              (COALESCE(end_at, now()) AT TIME ZONE $1) AS ends
         FROM location_sessions
        WHERE begin_at >= now() - ($2 || ' days')::interval
     ),
     expanded AS (
       SELECT user_login,
              generate_series(
                date_trunc('hour', starts),
                date_trunc('hour', ends),
                interval '1 hour'
              ) AS slot
         FROM bounded
        WHERE ends >= starts
          AND ends - starts < interval '20 hours'
     )
     SELECT to_char(slot::date, 'YYYY-MM-DD') AS date,
            EXTRACT(hour FROM slot)::int AS hour,
            count(DISTINCT user_login)::int AS students
       FROM expanded
      GROUP BY 1, 2`,
    [campusTimezone(), String(HISTORY_DAYS)],
  );
  return rows;
}

/**
 * Recomputes the outlook for today and the next three days and stores it under
 * today's date. Runs once a day (first scheduler tick after midnight), so the
 * numbers on the wall are fixed for the whole day rather than drifting with
 * every refresh.
 */
export async function runForecastJob(now = new Date()): Promise<{
  computedFor: string;
  days: number;
}> {
  const today = campusToday(now);
  const [history, hourly] = await Promise.all([
    readDailyAttendance(),
    readHourlyLoad(),
  ]);

  const outlook = buildOutlook(history, hourly, today);

  for (const forecast of outlook) {
    await query(
      `INSERT INTO attendance_forecasts
         (computed_for, target_date, expected_students, low_students,
          high_students, peak_hour, peak_students, sample_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (computed_for, target_date) DO UPDATE
         SET expected_students = EXCLUDED.expected_students,
             low_students = EXCLUDED.low_students,
             high_students = EXCLUDED.high_students,
             peak_hour = EXCLUDED.peak_hour,
             peak_students = EXCLUDED.peak_students,
             sample_days = EXCLUDED.sample_days,
             computed_at = now()`,
      [
        today,
        forecast.targetDate,
        forecast.expected,
        forecast.low,
        forecast.high,
        forecast.peakHour,
        forecast.peakStudents,
        forecast.sampleDays,
      ],
    );
  }

  // Keep a fortnight of past computations around; they are what a backtest of
  // the estimator would be run against.
  await query(
    "DELETE FROM attendance_forecasts WHERE computed_for < ($1::date - 14)",
    [today],
  );

  return { computedFor: today, days: outlook.length };
}

export async function hasForecastFor(day: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM attendance_forecasts WHERE computed_for = $1) AS exists",
    [day],
  );
  return rows[0]?.exists ?? false;
}
