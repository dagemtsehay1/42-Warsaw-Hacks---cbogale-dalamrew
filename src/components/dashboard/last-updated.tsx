"use client";

import { useSyncExternalStore } from "react";
import { formatClock, formatRelativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function subscribeClock(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 30_000);
  return () => window.clearInterval(id);
}

function getNow() {
  return Date.now();
}

function getServerNow() {
  return 0;
}

export function LastUpdated({
  fetchedAt,
  isFetching,
  isError,
  className,
}: {
  fetchedAt?: string;
  isFetching?: boolean;
  isError?: boolean;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribeClock, getNow, getServerNow);

  if (!fetchedAt) {
    return (
      <div className={cn("text-xs text-[var(--muted)]", className)}>
        {isFetching ? "Loading…" : "Waiting for data"}
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
      {isFetching && (
        <span className="ml-2 text-[var(--accent)]">Refreshing…</span>
      )}
      {isError && (
        <span className="ml-2 text-[var(--warning)]">Reconnecting…</span>
      )}
    </div>
  );
}
