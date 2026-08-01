"use client";

import { RefreshCw } from "lucide-react";
import { useRef } from "react";
import { CoalitionScoreChart } from "@/components/dashboard/coalition-score-chart";
import { DashboardClock } from "@/components/dashboard/dashboard-clock";
import { FullscreenToggle } from "@/components/dashboard/fullscreen-toggle";
import { LastUpdated } from "@/components/dashboard/last-updated";
import { Metric, MetricGroup } from "@/components/dashboard/metric";
import { PartnerLogos } from "@/components/dashboard/partner-logos";
import { PresenceBoard } from "@/components/dashboard/presence-board";
import { RecentPasses } from "@/components/dashboard/recent-passes";
import { ScreenRotation } from "@/components/dashboard/screen-rotation";
import { TopContributors } from "@/components/dashboard/top-contributors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampusDashboard } from "@/hooks/use-campus-dashboard";
import type { DashboardPayload } from "@/types/campus";
import { useDisplayStore } from "@/stores/display-store";
import { cn } from "@/lib/utils/cn";

export function CampusBoard({
  displayMode = false,
  initialData,
}: {
  displayMode?: boolean;
  /** Server-rendered payload, so the board paints with real data before JS runs. */
  initialData?: DashboardPayload | null;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const activeScreen = useDisplayStore((s) => s.activeScreen);
  const { data, isLoading, isFetching, isError, dataUpdatedAt, refetch } =
    useCampusDashboard(initialData);

  const fetchedAt = data?.fetchedAt ?? (dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined);

  return (
    <div
      ref={boardRef}
      className={cn(
        "flex min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]",
        displayMode ? "h-dvh" : "min-h-dvh lg:h-dvh",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-[0.08em] md:text-2xl">
              42 WARSAW
            </h1>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-[var(--muted)] sm:inline">
              Campus
            </span>
          </div>
          <LastUpdated
            fetchedAt={fetchedAt}
            isFetching={isFetching}
            isError={isError || Boolean(data?.errors?.length)}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <ScreenRotation />
          {!displayMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          )}
          <FullscreenToggle targetRef={boardRef} />
          <DashboardClock />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
        {isLoading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <div
            key={activeScreen}
            className="board-screen flex h-full min-h-0 flex-col gap-3"
          >
            {activeScreen === "presence" && (
              <>
                <MetricGroup>
                  <Metric label="On campus" value={data.pulse.studentsOnCampus} />
                  <Metric
                    label="Passed today"
                    value={data.pulse.projectsPassedToday}
                  />
                  <Metric
                    label="Passed this month"
                    value={data.pulse.projectsPassedMonth}
                  />
                  <Metric
                    label="Active projects"
                    value={data.pulse.activeProjects}
                  />
                </MetricGroup>
                <div className="min-h-0 flex-1">
                  <PresenceBoard
                    presence={data.presence}
                    earliestLogin={data.earliestLogin}
                  />
                </div>
              </>
            )}

            {activeScreen === "achievements" && (
              <div className="min-h-0 flex-1">
                <RecentPasses items={data.recentPasses} />
              </div>
            )}

            {activeScreen === "coalitions" && (
              <div className="grid min-h-0 flex-1 grid-rows-2 gap-3">
                <CoalitionScoreChart
                  history={data.coalitionScoreHistory}
                  coalitions={data.coalitions}
                />
                <TopContributors
                  coalitions={data.coalitions}
                  contributors={data.coalitionContributors}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center border border-[var(--border)] bg-[var(--panel)] p-8 text-center">
            <div>
              <p className="text-lg">Unable to load campus data</p>
              <Button className="mt-4" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </main>

      <PartnerLogos />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <Skeleton className="h-full min-h-64" />
        <Skeleton className="h-full min-h-64" />
      </div>
    </div>
  );
}
