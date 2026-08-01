"use client";

import { Trophy } from "lucide-react";
import { useSyncExternalStore } from "react";
import { FeaturedStudent } from "@/components/dashboard/featured-student";
import type { PresenceStudent } from "@/types/campus";
import { formatClock, formatSessionLength } from "@/lib/utils/format";

// The session length has to keep counting between the 30-minute data refreshes,
// otherwise the board would show a duration frozen at the last fetch.
function subscribeMinute(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(id);
}
const getNow = () => Date.now();
const getServerNow = () => 0;

export function HallOfFame({
  student,
  alsoFirstToday,
}: {
  student: PresenceStudent | null;
  alsoFirstToday?: boolean;
}) {
  // 0 only on the server; the client gets a real timestamp on its first render.
  const now = useSyncExternalStore(subscribeMinute, getNow, getServerNow);

  return (
    <FeaturedStudent
      icon={<Trophy className="h-4 w-4 text-[var(--accent)]" aria-hidden />}
      title="Hall of Fame"
      student={student}
      value={
        student && now > 0 ? formatSessionLength(student.beginAt, now) : "—"
      }
      caption={student ? `Longest session on campus · ${student.host}` : undefined}
      note={
        alsoFirstToday && student
          ? `First in today at ${formatClock(new Date(student.beginAt))}`
          : undefined
      }
      emptyMessage="Nobody is logged on a campus host right now."
    />
  );
}
