import { CalendarDays, MapPin, Users } from "lucide-react";
import { formatClock, formatShortDay } from "@/lib/utils/format";
import type { CampusEvent } from "@/types/campus";

/**
 * This week's events, grouped by day.
 *
 * Events that have already happened stay on the screen, dimmed. A wall display
 * is read at a glance by people who were not here yesterday, and "you missed
 * this" is useful context — hiding them would make a quiet Friday look like a
 * quiet week.
 */
export function EventsBoard({
  events,
  now = new Date(),
}: {
  events: CampusEvent[];
  now?: Date;
}) {
  const byDay = new Map<string, CampusEvent[]>();
  for (const event of events) {
    const key = new Date(event.beginAt).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  if (events.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
        <Header count={0} />
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Nothing scheduled at the campus this week.
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <Header count={events.length} />

      <div className="grid min-h-0 flex-1 auto-rows-fr gap-3 overflow-hidden p-4 md:grid-cols-2 xl:grid-cols-3">
        {[...byDay.entries()].map(([day, dayEvents]) => (
          <div key={day} className="flex min-h-0 flex-col gap-2">
            <h3 className="shrink-0 border-b border-[var(--border)] pb-1 text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
              {formatShortDay(new Date(day))}
            </h3>
            <ul className="flex min-h-0 flex-col gap-2 overflow-hidden">
              {dayEvents.map((event) => (
                <EventCard key={event.id} event={event} now={now} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Header({ count }: { count: number }) {
  return (
    <header className="flex items-center gap-2 border-b border-[var(--border)] px-6 py-4">
      <CalendarDays className="h-4 w-4 text-[var(--accent)]" aria-hidden />
      <div>
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Events this week
        </h2>
        <p className="text-xs text-[var(--muted)]">
          {count === 0
            ? "Nothing scheduled"
            : `${count} ${count === 1 ? "event" : "events"} · Monday to Monday`}
        </p>
      </div>
    </header>
  );
}

function EventCard({ event, now }: { event: CampusEvent; now: Date }) {
  const begins = new Date(event.beginAt);
  const ends = event.endAt ? new Date(event.endAt) : null;
  const past = (ends ?? begins) < now;

  return (
    <li
      className={`flex min-w-0 flex-col gap-1 border border-[var(--border)] bg-[var(--panel-elevated)] p-3 ${
        past ? "opacity-45" : ""
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-sm tabular-nums text-[var(--accent)]">
          {formatClock(begins)}
        </span>
        {event.kind && (
          <span className="truncate text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            {event.kind.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="line-clamp-2 text-sm font-medium leading-snug text-[var(--foreground)]">
        {event.name}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
        {event.location && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{event.location}</span>
          </span>
        )}
        {event.subscribers != null && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0" aria-hidden />
            {event.subscribers}
            {event.maxPeople ? `/${event.maxPeople}` : ""}
          </span>
        )}
      </div>
    </li>
  );
}
