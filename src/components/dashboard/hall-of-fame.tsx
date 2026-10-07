"use client";

import { Trophy } from "lucide-react";
import { useClock } from "@/lib/hooks/use-clock";
import { FeaturedStudent } from "@/components/dashboard/featured-student";
import type { SessionRecord } from "@/types/campus";
import {
  formatDuration,
  formatSessionLength,
  formatShortDay,
} from "@/lib/utils/format";

// An unfinished session has to keep counting between the 30-minute data
// refreshes, otherwise the board would show a duration frozen at the last fetch.
export function HallOfFame({
  session,
  weekStart,
}: {
  session: SessionRecord | null;
  weekStart: string;
}) {
  // 0 only on the server; the client gets a real timestamp on its first render.
  const now = useClock(60_000);

  // A session that is still running is only as long as `durationMs` said at
  // fetch time, so it is re-measured on the client; a finished one is final.
  const live = session != null && session.endAt == null && now > 0;
  const value = session
    ? live
      ? formatSessionLength(session.beginAt, now)
      : formatDuration(session.durationMs)
    : "—";

  return (
    <FeaturedStudent
      icon={<Trophy className="h-4 w-4 text-[var(--accent)]" aria-hidden />}
      title="Hall of Fame"
      student={session}
      value={value}
      caption={
        session
          ? `Longest session this week · ${formatShortDay(new Date(session.beginAt))} · ${session.host}`
          : undefined
      }
      note={
        session
          ? live
            ? "Still logged in — the record is still growing"
            : `Since Monday ${formatShortDay(new Date(weekStart))}`
          : undefined
      }
      emptyMessage="No host sessions recorded since Monday."
    />
  );
}
