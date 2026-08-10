import { query } from "@/lib/db/pool";
import type { SessionUser } from "@/lib/auth/session";
import type { TeammateRequest } from "@/types/campus";

/**
 * Entries older than this drop off the board on their own.
 *
 * Nobody comes back to tick "found someone" — the whole interaction is meant to
 * be two taps on a phone. So a listing expires instead, and a student who still
 * needs a teammate next week can re-add in the same two taps. Without this the
 * board slowly fills with people who paired up a month ago.
 */
export const TEAMMATE_TTL_DAYS = 14;

/** Rows on the board screen. Enough to fill it, few enough to stay readable. */
const BOARD_LIMIT = 12;

type Row = {
  id: string;
  login: string;
  display_name: string;
  image_url: string | null;
  project_id: number;
  project_name: string;
  project_slug: string;
  created_at: string;
};

function toRequest(row: Row): TeammateRequest {
  return {
    id: Number(row.id),
    login: row.login,
    displayName: row.display_name,
    imageUrl: row.image_url ?? undefined,
    projectId: row.project_id,
    projectName: row.project_name,
    projectSlug: row.project_slug,
    createdAt: row.created_at,
  };
}

const SELECT = `
  SELECT id::text AS id, login, display_name, image_url,
         project_id, project_name, project_slug,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
    FROM teammate_requests
   WHERE created_at > now() - ($1 || ' days')::interval`;

/** Everyone currently looking, newest first. */
export async function listTeammateRequests(): Promise<TeammateRequest[]> {
  const rows = await query<Row>(
    `${SELECT} ORDER BY created_at DESC LIMIT ${BOARD_LIMIT}`,
    [String(TEAMMATE_TTL_DAYS)],
  );
  return rows.map(toRequest);
}

/** What one student has listed — the "remove" view after a second scan. */
export async function listRequestsForUser(
  userId: number,
): Promise<TeammateRequest[]> {
  const rows = await query<Row>(
    `${SELECT} AND user_id = $2 ORDER BY created_at DESC`,
    [String(TEAMMATE_TTL_DAYS), String(userId)],
  );
  return rows.map(toRequest);
}

/**
 * Adds a listing. Re-adding refreshes `created_at` rather than erroring, which
 * doubles as the way to keep an entry alive past the TTL.
 *
 * The profile fields come from the session — i.e. from 42 at login — so a
 * student can only ever list themselves.
 */
export async function addTeammateRequest(
  user: SessionUser,
  project: { projectId: number; projectName: string; projectSlug: string },
): Promise<void> {
  await query(
    `INSERT INTO teammate_requests
       (user_id, login, display_name, image_url, project_id, project_name, project_slug)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, project_id) DO UPDATE
       SET created_at   = now(),
           display_name = EXCLUDED.display_name,
           image_url    = EXCLUDED.image_url,
           project_name = EXCLUDED.project_name`,
    [
      user.id,
      user.login,
      user.displayName,
      user.imageUrl ?? null,
      project.projectId,
      project.projectName,
      project.projectSlug,
    ],
  );
}

/** Removes one listing. Scoped to the user id, so nobody can remove anyone else. */
export async function removeTeammateRequest(
  userId: number,
  projectId: number,
): Promise<void> {
  await query(
    "DELETE FROM teammate_requests WHERE user_id = $1 AND project_id = $2",
    [userId, projectId],
  );
}

/** Housekeeping for the ingest job. */
export async function pruneTeammateRequests(): Promise<number> {
  const rows = await query<{ count: string }>(
    `WITH gone AS (
       DELETE FROM teammate_requests
        WHERE created_at <= now() - ($1 || ' days')::interval
        RETURNING 1
     )
     SELECT count(*)::text AS count FROM gone`,
    [String(TEAMMATE_TTL_DAYS)],
  );
  return Number(rows[0]?.count ?? 0);
}
