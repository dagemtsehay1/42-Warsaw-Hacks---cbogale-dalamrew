import type { ActiveProjectStat } from "@/types/campus";
import { formatNumber } from "@/lib/utils/format";

export function ActiveProjects({ projects }: { projects: ActiveProjectStat[] }) {
  if (!projects.length) {
    return (
      <section className="border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Active Projects
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          No in-progress projects in the latest fetch.
        </p>
      </section>
    );
  }

  const max = Math.max(...projects.map((p) => p.studentCount), 1);

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Active Projects
        </h2>
        <p className="text-xs text-[var(--muted)]">Students currently working, by project</p>
      </header>
      <ul className="min-h-0 flex-1 space-y-5 overflow-hidden p-6">
        {projects.map((project) => (
          <li key={project.projectId}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-lg font-medium md:text-xl">
                {project.projectName}
              </span>
              <span className="font-mono text-lg tabular-nums text-[var(--accent)] md:text-xl">
                {formatNumber(project.studentCount)}
              </span>
            </div>
            <div className="mt-2 h-2 bg-[var(--panel-elevated)]">
              <div
                className="h-full bg-[var(--accent)]"
                style={{ width: `${(project.studentCount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
