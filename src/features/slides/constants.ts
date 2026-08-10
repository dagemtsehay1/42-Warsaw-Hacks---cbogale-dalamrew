/**
 * Upload limits, kept apart from `repository.ts` on purpose.
 *
 * The upload form is a client component and needs these to describe itself; the
 * repository imports `pg`. Importing one from the other would pull Postgres into
 * the browser bundle, which is a build error rather than a subtle problem — but
 * only once something actually references it, so the split is the guard.
 */

/**
 * A slide is a poster on a TV, not an archive master. 4MB is generous for a
 * 1080p JPEG and small enough that a stray 40MB PNG can't bloat the database or
 * stall the board's render.
 */
export const MAX_SLIDE_BYTES = 4 * 1024 * 1024;

/** What a browser will display without a plugin. */
export const ALLOWED_SLIDE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
