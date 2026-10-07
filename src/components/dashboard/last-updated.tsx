"use client";

import { useClock } from "@/lib/hooks/use-clock";
import { formatClock, formatRelativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function LastUpdated({
  fetchedAt,
  isError,
  className,
}: {
  /** When the ingest job that produced the data on screen ran. */
  fetchedAt?: string;
  isError?: boolean;
  className?: string;
}) {
  const now = useClock(30_000);

  if (!fetchedAt) {
    return (
      <div className={cn("text-xs text-[var(--muted)]", className)}>
        Waiting for data
      </div>
    );
  }

  const date = new Date(fetchedAt);
  const ageMin = now === 0 ? 0 : (now - date.getTime()) / 60_000;
  const stale = ageMin > 35;

  return (
    <div className={cn("text-xs md:text-sm", className)}>
      <span className="text-[var(--muted)]">Last updated </span>
      <span className="font-mono tabular-nums">{formatClock(date)}</span>
      {stale && (
        <span className="ml-2 text-[var(--warning)]">
          ({formatRelativeTime(date, new Date(now))})
        </span>
      )}
      {isError && (
        <span className="ml-2 text-[var(--warning)]">
          Last ingest was incomplete
        </span>
      )}
    </div>
  );
}
