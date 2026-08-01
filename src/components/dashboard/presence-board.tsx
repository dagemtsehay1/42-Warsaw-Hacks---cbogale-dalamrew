import { Sunrise } from "lucide-react";
import { FeaturedStudent } from "@/components/dashboard/featured-student";
import { HallOfFame } from "@/components/dashboard/hall-of-fame";
import { StudentAvatar } from "@/components/ui/student-avatar";
import type { PresenceStudent, SessionRecord } from "@/types/campus";
import { formatClock } from "@/lib/utils/format";

export function PresenceBoard({
  presence,
  earliestLogin,
  topSessionThisWeek,
  weekStart,
}: {
  presence: PresenceStudent[];
  earliestLogin: PresenceStudent | null;
  topSessionThisWeek: SessionRecord | null;
  weekStart: string;
}) {
  return (
    // Honours on top at their content height, the room list taking whatever is
    // left — the two cards are the thing you read from across the hallway.
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <HallOfFame session={topSessionThisWeek} weekStart={weekStart} />

        <FeaturedStudent
          icon={<Sunrise className="h-4 w-4 text-[var(--accent)]" aria-hidden />}
          title="First on Campus Today"
          student={earliestLogin}
          value={
            earliestLogin ? formatClock(new Date(earliestLogin.beginAt)) : "—"
          }
          caption={
            earliestLogin
              ? `First known host session · ${earliestLogin.host}`
              : undefined
          }
          emptyMessage="No campus login sessions found for today yet."
        />
      </div>

      <div className="flex min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
        <header className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
            On Campus Now
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Live host sessions from locations API
          </p>
        </header>
        {presence.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">
            No active campus locations right now.
          </p>
        ) : (
          <ul className="grid flex-1 auto-rows-max grid-cols-2 content-start gap-3 overflow-hidden p-4 md:grid-cols-4 xl:grid-cols-6">
            {presence.slice(0, 24).map((student) => (
              <li
                key={`${student.login}-${student.host}`}
                className="flex items-center gap-3 border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-3"
              >
                <StudentAvatar src={student.imageUrl} alt={student.login} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-base font-medium">
                    {student.login}
                  </div>
                  <div className="truncate font-mono text-xs text-[var(--muted)]">
                    {student.host}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
