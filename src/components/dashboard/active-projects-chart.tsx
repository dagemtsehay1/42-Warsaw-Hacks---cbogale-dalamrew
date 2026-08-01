import type { ActiveProjectStat } from "@/types/campus";
import { SERIES_ACCENT } from "@/lib/charts/palette";
import { formatNumber } from "@/lib/utils/format";

/**
 * Students per in-progress project.
 *
 * Server-rendered bars: a horizontal bar chart is a row of divs with a width
 * percentage, so this needs no chart runtime in the browser at all.
 */
export function ActiveProjectsChart({
  projects,
}: {
  projects: ActiveProjectStat[];
}) {
  if (!projects.length) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <Heading />
        </header>
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          No in-progress projects in the latest fetch.
        </div>
      </section>
    );
  }

  const ranked = [...projects].sort((a, b) => b.studentCount - a.studentCount);
  const max = ranked[0]?.studentCount || 1;

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <Heading />
      </header>
      <ul className="flex min-h-0 flex-1 flex-col justify-around gap-1 overflow-hidden p-4">
        {ranked.map((project) => (
          <li key={project.projectId} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-right text-sm text-[var(--muted)]">
              {project.projectName}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="h-5 rounded-r-[4px]"
                style={{
                  backgroundColor: SERIES_ACCENT,
                  // Percentage of the busiest project, so the widest bar always
                  // reaches the end of the track.
                  width: `${Math.max((project.studentCount / max) * 100, 1.5)}%`,
                }}
                aria-hidden
              />
              <span className="font-mono text-base tabular-nums text-[var(--foreground)]">
                {formatNumber(project.studentCount)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Heading() {
  return (
    <>
      <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        What Campus Is Building
      </h2>
      <p className="text-xs text-[var(--muted)]">
        Students registered on each project, in progress in the last two weeks
      </p>
    </>
  );
}
