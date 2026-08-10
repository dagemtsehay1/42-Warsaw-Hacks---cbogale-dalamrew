import { weekStart } from "@/features/campus/sessions";
import { fetchCampusEvents } from "@/lib/api/42/resources";
import type { FortyTwoEvent } from "@/lib/api/42/types";
import { query } from "@/lib/db/pool";
import type { CampusEvent } from "@/types/campus";

/**
 * "This week" for the events screen is the same window the Hall of Fame uses:
 * Monday 05:00 to the following Monday 05:00, campus-local. One definition of a
 * week across the board beats two that disagree by five hours.
 */
export function eventWeek(now = new Date()): { from: Date; to: Date } {
  const from = weekStart(now);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

/**
 * The events endpoint's shape could not be verified against the live 42 API, so
 * everything except `id`, `name` and `begin_at` is treated as optional and a row
 * that lacks those three is dropped rather than stored half-formed.
 */
export function toCampusEvent(event: FortyTwoEvent): CampusEvent | null {
  if (!event?.id || !event.name || !event.begin_at) return null;
  if (Number.isNaN(new Date(event.begin_at).getTime())) return null;

  return {
    id: event.id,
    name: event.name,
    description: event.description ?? null,
    kind: event.kind ?? null,
    location: event.location ?? null,
    beginAt: event.begin_at,
    endAt: event.end_at ?? null,
    maxPeople: event.max_people ?? null,
    subscribers: event.nbr_subscribers ?? null,
  };
}

/** Pulls this week's events and upserts them. Called from the ingest job. */
export async function syncCampusEvents(campusId: number): Promise<number> {
  const { from, to } = eventWeek();
  const raw = await fetchCampusEvents(
    campusId,
    from.toISOString(),
    to.toISOString(),
  );

  const events = raw
    .map(toCampusEvent)
    .filter((e): e is CampusEvent => e != null);

  for (const event of events) {
    await query(
      `INSERT INTO campus_events
         (id, campus_id, name, description, kind, location, begin_at, end_at,
          max_people, subscribers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE
         SET name        = EXCLUDED.name,
             description = EXCLUDED.description,
             kind        = EXCLUDED.kind,
             location    = EXCLUDED.location,
             begin_at    = EXCLUDED.begin_at,
             end_at      = EXCLUDED.end_at,
             max_people  = EXCLUDED.max_people,
             subscribers = EXCLUDED.subscribers,
             updated_at  = now()`,
      [
        event.id,
        campusId,
        event.name,
        event.description,
        event.kind,
        event.location,
        event.beginAt,
        event.endAt,
        event.maxPeople,
        event.subscribers,
      ],
    );
  }

  // Past weeks are never displayed; keep a month for a bit of history.
  await query(
    "DELETE FROM campus_events WHERE begin_at < now() - interval '30 days'",
  );

  return events.length;
}

/**
 * This week's events, earliest first.
 *
 * Events that have already finished are kept in the window rather than hidden —
 * "what happened this week" is as much a part of the screen as what is coming,
 * and the UI dims them instead.
 */
export async function readWeekEvents(now = new Date()): Promise<CampusEvent[]> {
  const { from, to } = eventWeek(now);

  return query<CampusEvent>(
    `SELECT id::int AS id,
            name,
            description,
            kind,
            location,
            to_char(begin_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "beginAt",
            CASE WHEN end_at IS NULL THEN NULL
                 ELSE to_char(end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            END AS "endAt",
            max_people AS "maxPeople",
            subscribers
       FROM campus_events
      WHERE begin_at >= $1 AND begin_at < $2
      ORDER BY begin_at`,
    [from.toISOString(), to.toISOString()],
  );
}
