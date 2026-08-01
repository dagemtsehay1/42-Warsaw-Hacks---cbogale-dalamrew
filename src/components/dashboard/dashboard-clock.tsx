"use client";

import { useSyncExternalStore } from "react";
import { formatClock, formatLongDate } from "@/lib/utils/format";

// Rendering the current time during SSR guarantees a hydration mismatch whenever the
// server render and the client hydration land in different minutes — React then throws
// the whole tree away and re-renders it. Reading the clock through an external store
// keeps the server output deterministic and fills the real time in on the client.
function subscribeSecond(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}
const getSeconds = () => Math.floor(Date.now() / 1000);
const getServerSeconds = () => 0;

export function DashboardClock() {
  const seconds = useSyncExternalStore(
    subscribeSecond,
    getSeconds,
    getServerSeconds,
  );
  const now = seconds > 0 ? new Date(seconds * 1000) : null;

  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-2xl tracking-tight tabular-nums md:text-3xl">
        {now ? formatClock(now) : "--:--"}
      </div>
      <div className="text-xs text-[var(--muted)] md:text-sm">
        {now ? formatLongDate(now) : " "}
      </div>
    </div>
  );
}
