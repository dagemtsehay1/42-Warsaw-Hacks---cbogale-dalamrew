import { StudentAvatar } from "@/components/ui/student-avatar";
import type { ProjectPass } from "@/types/campus";
import { formatRelativeTime } from "@/lib/utils/format";

export function RecentPasses({ items }: { items: ProjectPass[] }) {
  if (!items.length) {
    return (
      <EmptyPanel title="Recently passed" message="No recent project validations in the latest fetch." />
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Recently Passed
        </h2>
      </header>
      {/* Twenty students only fit on a 1080p panel in two columns, so this is a
          grid rather than a list stack. `auto-rows-fr` spreads the rows over the
          full panel height instead of stacking them at the top under dead space. */}
      <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 overflow-hidden xl:grid-cols-2">
        {items.slice(0, 20).map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5"
          >
            <StudentAvatar src={item.imageUrl} alt={item.login} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-medium">{item.login}</div>
              <div className="truncate text-sm text-[var(--muted)]">
                {item.projectName}
                {item.markedAt ? ` · ${formatRelativeTime(item.markedAt)}` : ""}
              </div>
            </div>
            <div className="font-mono text-xl tabular-nums text-[var(--accent)]">
              {item.score != null ? `${item.score}` : "OK"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        {title}
      </h2>
      <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
    </section>
  );
}
