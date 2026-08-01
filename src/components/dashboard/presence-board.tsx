import { Sunrise } from "lucide-react";
import { FeaturedStudent } from "@/components/dashboard/featured-student";
import { HallOfFame } from "@/components/dashboard/hall-of-fame";
import { StudentAvatar } from "@/components/ui/student-avatar";
import type { PresenceStudent } from "@/types/campus";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function PresenceBoard({
  presence,
  earliestLogin,
}: {
  presence: PresenceStudent[];
  earliestLogin: PresenceStudent | null;
}) {
  // `presence` arrives sorted by session start, so the first entry is whoever has
  // been on a host longest right now.
  const longestSession = presence[0] ?? null;
  // These two honours often belong to the same person; showing one card avoids
  // putting the same face on screen twice.
  const sharedHolder =
    longestSession != null && longestSession.login === earliestLogin?.login;

  return (
    <section className="grid h-full min-h-0 gap-3 lg:grid-cols-[1.2fr_1fr]">
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
          <ul className="grid flex-1 auto-rows-max grid-cols-2 gap-3 content-start p-4 md:grid-cols-3 xl:grid-cols-4">
            {presence.slice(0, 24).map((student) => (
              <li
                key={`${student.login}-${student.host}`}
                className="flex items-center gap-3 border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-3"
              >
                <StudentAvatar src={student.imageUrl} alt={student.login} size={48} />
                <div className="min-w-0">
                  <div className="truncate text-base font-medium md:text-lg">
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

      <div
        className={cn(
          "grid min-h-0 gap-3",
          sharedHolder ? "grid-rows-1" : "grid-rows-2",
        )}
      >
        <HallOfFame student={longestSession} alsoFirstToday={sharedHolder} />

        {!sharedHolder && (
          <FeaturedStudent
            icon={<Sunrise className="h-4 w-4 text-[var(--accent)]" aria-hidden />}
            title="First on Campus Today"
            student={earliestLogin}
            value={
              earliestLogin
                ? formatClock(new Date(earliestLogin.beginAt))
                : "—"
            }
            caption={
              earliestLogin
                ? `First known host session · ${earliestLogin.host}`
                : undefined
            }
            emptyMessage="No campus login sessions found for today yet."
          />
        )}
      </div>
    </section>
  );
}
