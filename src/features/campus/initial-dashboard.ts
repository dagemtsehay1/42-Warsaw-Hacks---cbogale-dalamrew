import { unstable_cache } from "next/cache";
import { buildDashboardPayload } from "@/features/campus/dashboard-service";
import { DASHBOARD_STALE_MS } from "@/lib/query/client";
import type { DashboardPayload } from "@/types/campus";

/**
 * Building the payload walks the coalition score ledgers and takes ~25s, so it is
 * cached on the same cadence the board refreshes. Without this every page load —
 * including the TV reconnecting — would block on the full 42 API round trip.
 */
const loadDashboard = unstable_cache(
  async () => buildDashboardPayload(),
  // Version suffix: the cache outlives a deploy, so an entry written against an
  // older `DashboardPayload` shape would be served to a board that expects the
  // new fields. Bump it whenever the payload gains or loses a field.
  ["campus-dashboard-v3"],
  { revalidate: DASHBOARD_STALE_MS / 1000 },
);

/**
 * Builds the dashboard payload for server rendering.
 *
 * `buildDashboardPayload` soft-fails per section, but the campus lookup it starts with
 * can still throw outright (bad credentials, 42 API down). A signage screen must never
 * show an error page over that, so a hard failure degrades to client-side fetching:
 * the board renders its skeleton and React Query takes over.
 */
export async function getInitialDashboard(): Promise<DashboardPayload | null> {
  try {
    return await loadDashboard();
  } catch (error) {
    console.error("Server-side dashboard render failed:", error);
    return null;
  }
}
