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
              // Five rows share the bottom half of the screen with the chart, so
              // they run tighter than the other boards and clip rather than push.
              <ul className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-hidden">
                {top.map((contributor, index) => (
                  <li
                    key={contributor.login}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <span className="w-5 font-mono text-base text-[var(--muted)]">
                      {index + 1}
                    </span>
                    <StudentAvatar
                      src={contributor.imageUrl}
                      alt={contributor.login}
                      size={36}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium md:text-base">
                      {contributor.login}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-[var(--foreground)] md:text-base">
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
