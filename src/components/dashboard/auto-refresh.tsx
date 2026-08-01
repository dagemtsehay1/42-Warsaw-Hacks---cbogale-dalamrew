"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { INGEST_INTERVAL_MS } from "@/lib/dashboard-config";

/** Never hammer the server if a timestamp arrives in a strange state. */
const MIN_DELAY_MS = 30_000;

/**
 * Reloads the server-rendered board when the next ingest is due.
 *
 * `router.refresh()` re-runs the page on the server and streams new markup in —
 * the browser keeps no copy of the campus data and runs no fetching logic of its
 * own. `nextRefreshAt` comes from the snapshot the page was rendered with, so
 * the board follows the ingest schedule (30 min + a grace period) rather than a
 * timer of its own that would drift out of step with it.
 */
export function AutoRefresh({ nextRefreshAt }: { nextRefreshAt: string }) {
  const router = useRouter();

  useEffect(() => {
    const due = new Date(nextRefreshAt).getTime();
    const delay = Number.isFinite(due)
      ? Math.max(MIN_DELAY_MS, due - Date.now())
      : INGEST_INTERVAL_MS;

    const timer = window.setTimeout(() => router.refresh(), delay);
    return () => window.clearTimeout(timer);
    // Re-armed after every refresh: the new page carries the next timestamp.
  }, [nextRefreshAt, router]);

  return null;
}
