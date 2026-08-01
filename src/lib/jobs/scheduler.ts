import { campusToday } from "@/features/campus/campus-time";
import { hasForecastFor, runForecastJob } from "@/features/campus/forecast-job";
import { runIngest } from "@/features/campus/ingest";
import { hasFortyTwoCredentials } from "@/lib/api/42/config";
import { INGEST_INTERVAL_MS } from "@/lib/dashboard-config";
import { hasDatabase, migrate, query, withClient } from "@/lib/db/pool";

/** How often the scheduler looks for due work. */
const TICK_MS = 60_000;

/**
 * Postgres advisory lock id. Job runs are guarded by it so that two app
 * instances (or a dev server restarting into a still-running one) can't both
 * hammer the rate-limited 42 API.
 */
const LOCK_ID = 4242_0001;

type JobName = "ingest" | "forecast";

let started = false;

async function recordRun(
  job: JobName,
  run: () => Promise<unknown>,
): Promise<void> {
  const [{ id }] = await query<{ id: string }>(
    "INSERT INTO job_runs (job, status) VALUES ($1, 'running') RETURNING id::text AS id",
    [job],
  );

  try {
    const detail = await run();
    await query(
      "UPDATE job_runs SET status = 'success', finished_at = now(), detail = $2 WHERE id = $1",
      [id, JSON.stringify(detail ?? {})],
    );
    console.log(`[jobs] ${job} ok`, detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await query(
      "UPDATE job_runs SET status = 'failed', finished_at = now(), detail = $2 WHERE id = $1",
      [id, JSON.stringify({ error: message })],
    );
    console.error(`[jobs] ${job} failed:`, message);
  }
}

async function ingestIsDue(): Promise<boolean> {
  const rows = await query<{ due: boolean }>(
    `SELECT coalesce(
              max(started_at) < now() - ($1 || ' milliseconds')::interval,
              true
            ) AS due
       FROM job_runs
      WHERE job = 'ingest' AND status = 'success'`,
    [String(INGEST_INTERVAL_MS)],
  );
  return rows[0]?.due ?? true;
}

/**
 * One pass of the schedule:
 *
 * - **ingest** every 30 minutes — pull the 42 API and snapshot it;
 * - **forecast** once per campus-local day — the first tick after midnight
 *   computes the day's numbers, and nothing recomputes them until tomorrow.
 *
 * Both are driven off what the database says already happened rather than off
 * timers held in memory, so a restart resumes the schedule instead of resetting
 * it, and a missed midnight is caught on the next tick.
 */
export async function runDueJobs(): Promise<void> {
  await withClient(async (client) => {
    const locked = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK_ID],
    );
    if (!locked.rows[0]?.locked) return;

    try {
      if (await ingestIsDue()) {
        await recordRun("ingest", runIngest);
      }
      const today = campusToday();
      if (!(await hasForecastFor(today))) {
        await recordRun("forecast", () => runForecastJob());
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
    }
  });
}

/**
 * Starts the background schedule. Called from `instrumentation.ts` when the
 * server boots — the app is its own worker, so there is nothing else to deploy.
 */
export function startScheduler(): void {
  if (started) return;
  if (!hasDatabase()) {
    console.warn("[jobs] DATABASE_URL is not set — scheduler disabled");
    return;
  }
  if (!hasFortyTwoCredentials()) {
    console.warn("[jobs] 42 API credentials missing — scheduler disabled");
    return;
  }
  started = true;

  const tick = async () => {
    try {
      await migrate();
      await runDueJobs();
    } catch (error) {
      console.error("[jobs] tick failed:", error);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  // Never hold the process open on the schedule alone.
  timer.unref?.();
}
