import { QueryClient } from "@tanstack/react-query";

export const DASHBOARD_STALE_MS = 30 * 60_000;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 60 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status =
            typeof error === "object" &&
            error &&
            "status" in error &&
            typeof (error as { status?: unknown }).status === "number"
              ? (error as { status: number }).status
              : undefined;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
