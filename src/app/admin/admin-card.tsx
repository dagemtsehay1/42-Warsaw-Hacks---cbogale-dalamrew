import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function AdminCard({ title, description, children, defaultOpen = false }: {
  title: string; description: string; children: ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg p-5 focus-visible:outline-2 focus-visible:outline-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-semibold">{title}</span>
          <span className="mt-1 block text-sm text-[var(--muted)]">{description}</span>
        </span>
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-[var(--border)] p-4 sm:p-5">{children}</div>
    </details>
  );
}
