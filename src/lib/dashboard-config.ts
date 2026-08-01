/** How often the background ingest pulls the 42 API. */
export const INGEST_INTERVAL_MS = 30 * 60_000;

/**
 * How long after an ingest the board reloads. The client waits for the *next*
 * ingest to land plus this grace period, so a refresh always finds new data
 * instead of racing the job.
 */
export const REFRESH_GRACE_MS = 30_000;

/** Past this age the header calls the data stale. */
export const STALE_AFTER_MS = INGEST_INTERVAL_MS * 2;
