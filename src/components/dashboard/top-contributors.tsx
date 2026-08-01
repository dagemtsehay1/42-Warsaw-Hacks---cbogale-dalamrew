import { StudentAvatar } from "@/components/ui/student-avatar";
import type { CoalitionContributors, CoalitionSummary } from "@/types/campus";
import { formatNumber } from "@/lib/utils/format";

export function TopContributors({
  coalitions,
  contributors,
}: {
  coalitions: CoalitionSummary[];
  contributors: CoalitionContributors[];
}) {
  if (!coalitions.length) return null;

  return (
    <section className="grid h-full min-h-0 gap-3" style={{
      gridTemplateColumns: `repeat(${coalitions.length}, minmax(0, 1fr))`,
    }}>
      {coalitions.map((coalition) => {
        const top = contributors.find((c) => c.coalitionId === coalition.id)
          ?.contributors ?? [];
        return (
          <div
            key={coalition.id}
            className="flex min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]"
          >
            <header
              className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3"
              style={{ borderBottomColor: coalition.color }}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: coalition.color }}
                aria-hidden
              />
              <h3 className="truncate text-sm font-semibold uppercase tracking-[0.1em]">
                {coalition.name}
              </h3>
            </header>
            {top.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">
                No contributor data available.
              </p>
            ) : (
              <ul className="flex-1 divide-y divide-[var(--border)]">
                {top.map((contributor, index) => (
                  <li
                    key={contributor.login}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="w-5 font-mono text-lg text-[var(--muted)]">
                      {index + 1}
                    </span>
                    <StudentAvatar
                      src={contributor.imageUrl}
                      alt={contributor.login}
                      size={40}
                    />
                    <span className="min-w-0 flex-1 truncate text-base font-medium md:text-lg">
                      {contributor.login}
                    </span>
                    <span className="font-mono text-base tabular-nums text-[var(--foreground)] md:text-lg">
                      {formatNumber(contributor.score)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
