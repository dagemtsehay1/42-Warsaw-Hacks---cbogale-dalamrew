"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardPayload } from "@/types/campus";
import { DASHBOARD_STALE_MS } from "@/lib/query/client";

async function fetchDashboard(): Promise<DashboardPayload> {
  const response = await fetch("/api/campus/dashboard");
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    const error = new Error(body?.error || "Failed to load dashboard") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<DashboardPayload>;
}

/**
 * @param initialData Payload rendered on the server, so the first paint already has
 * real content instead of a skeleton. `initialDataUpdatedAt` is taken from the
 * payload's own timestamp — without it React Query would treat server data as
 * freshly fetched and skip the client refresh for a full interval.
 */
export function useCampusDashboard(initialData?: DashboardPayload | null) {
  return useQuery({
    queryKey: ["campus", "dashboard"],
    queryFn: fetchDashboard,
    staleTime: DASHBOARD_STALE_MS,
    refetchInterval: DASHBOARD_STALE_MS,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData
      ? new Date(initialData.fetchedAt).getTime()
      : undefined,
  });
}
