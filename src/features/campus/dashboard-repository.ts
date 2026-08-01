import { campusToday } from "@/features/campus/campus-time";
import { getInitialDashboard } from "@/features/campus/initial-dashboard";
import {
  INGEST_INTERVAL_MS,
  REFRESH_GRACE_MS,
  STALE_AFTER_MS,
} from "@/lib/dashboard-config";
import { hasDatabase, migrate, query } from "@/lib/db/pool";
import type { DashboardPayload, DashboardView, DayForecast } from "@/types/campus";

/**
 * The read path. Pages and the API route both come through here, and none of it
 * touches the 42 API: the board is whatever the ingest job last stored, plus the
 * forecast the nightly job computed. That is what keeps the display up when the
 * 42 API is down, and what keeps the request fast (two indexed queries).
 */
export async function readDashboardView(): Promise<DashboardView> {
  if (hasDatabase()) {
    try {
      await migrate();
      const view = await readFromDatabase();
      if (view) return view;
    } catch (error) {
      console.error("[dashboard] database read failed:", error);
    }
  }

  // No database configured, or nothing ingested yet: fall back to building a
  // payload directly so the app is still runnable (`npm run dev` with no
  // Postgres, or the first minute after a deploy).
  const payload = await getInitialDashboard();
  const capturedAt = payload?.fetchedAt ?? new Date().toISOString();
  return {
    payload,
    capturedAt,
    nextRefreshAt: new Date(
      new Date(capturedAt).getTime() + INGEST_INTERVAL_MS + REFRESH_GRACE_MS,
    ).toISOString(),
    stale: false,
    source: hasDatabase() ? "warming-up" : "live",
    forecast: [],
  };
}

async function readFromDatabase(): Promise<DashboardView | null> {
  const snapshots = await query<{ captured_at: string; payload: DashboardPayload }>(
    `SELECT to_char(captured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS captured_at,
            payload
       FROM dashboard_snapshots
      ORDER BY captured_at DESC
      LIMIT 1`,
  );
  const snapshot = snapshots[0];
  if (!snapshot) return null;

  const forecast = await readForecast();
  const capturedMs = new Date(snapshot.captured_at).getTime();

  return {
    payload: snapshot.payload,
    capturedAt: snapshot.captured_at,
    nextRefreshAt: new Date(
      capturedMs + INGEST_INTERVAL_MS + REFRESH_GRACE_MS,
    ).toISOString(),
    stale: Date.now() - capturedMs > STALE_AFTER_MS,
    source: "database",
    forecast,
  };
}

/**
 * Today's stored outlook. Only rows computed *today* are read: if the nightly
 * job hasn't run yet the board shows no numbers rather than yesterday's.
 */
async function readForecast(): Promise<DayForecast[]> {
  return query<DayForecast>(
    `SELECT to_char(target_date, 'YYYY-MM-DD') AS "targetDate",
            expected_students AS expected,
            low_students AS low,
            high_students AS high,
            peak_hour AS "peakHour",
            peak_students AS "peakStudents",
            sample_days AS "sampleDays"
       FROM attendance_forecasts
      WHERE computed_for = $1
      ORDER BY target_date`,
    [campusToday()],
  );
}
