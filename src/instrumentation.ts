/**
 * Next runs this once per server process on boot. The background jobs (42 API
 * ingest every 30 minutes, attendance forecast once a day) live here, so the
 * deployment is still a single container: the web server *is* the worker.
 *
 * Only the Node runtime gets the scheduler — the edge runtime has no sockets for
 * Postgres — and the jobs themselves take a Postgres advisory lock, so running
 * several instances does not multiply the API traffic.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScheduler } = await import("@/lib/jobs/scheduler");
  startScheduler();
}
