import { ActiveProjectsChart } from "@/components/dashboard/active-projects-chart";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CoalitionScoreChart } from "@/components/dashboard/coalition-score-chart";
import { DashboardClock } from "@/components/dashboard/dashboard-clock";
import { EventsBoard } from "@/components/dashboard/events-board";
import { ForecastMetrics } from "@/components/dashboard/forecast-metrics";
import { FullscreenToggle } from "@/components/dashboard/fullscreen-toggle";
import { LastUpdated } from "@/components/dashboard/last-updated";
import { LevelDistributionChart } from "@/components/dashboard/level-distribution-chart";
import { Metric, MetricGroup } from "@/components/dashboard/metric";
import { PartnerLogos } from "@/components/dashboard/partner-logos";
import { PresenceBoard } from "@/components/dashboard/presence-board";
import { RecentPasses } from "@/components/dashboard/recent-passes";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ScreenRotation } from "@/components/dashboard/screen-rotation";
import { ScreenAvailability } from "@/components/dashboard/screen-availability";
import { ScreenSwitcher } from "@/components/dashboard/screen-switcher";
import { SlideShow } from "@/components/dashboard/slide-show";
import { TeammateBoard } from "@/components/dashboard/teammate-board";
import { TeammateLiveUpdates } from "@/components/dashboard/teammate-live-updates";
import { TopContributors } from "@/components/dashboard/top-contributors";
import { campusToday } from "@/features/campus/campus-time";
import type { DashboardView } from "@/types/campus";
import { formatLevel, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const BOARD_ID = "campus-board";

/**
 * The board, rendered on the server.
 *
 * Everything here — every screen, both charts, every list — is server markup
 * built from a payload the ingest job already stored. The browser downloads no
 * campus data, no charting library and no query client; the only client code is
 * the rotation, the clock, the fullscreen button and the refresh timer.
 */
export function CampusBoard({
  view,
  displayMode = false,
}: {
  view: DashboardView;
  displayMode?: boolean;
}) {
  const data = view.payload;
  const today = campusToday();

  return (
    <div
      id={BOARD_ID}
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
            fetchedAt={view.capturedAt}
            isError={view.stale || Boolean(data?.errors?.length)}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <ScreenRotation />
          {!displayMode && <RefreshButton />}
          <FullscreenToggle targetId={BOARD_ID} />
          <DashboardClock />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
        {data ? (
          <ScreenSwitcher
            screens={{
              stats: (
                <>
                  <MetricGroup className="md:grid-cols-5">
                    <Metric
                      label="Students in cursus"
                      value={data.stats.studentsInCursus}
                      // hint={`${formatNumber(data.stats.campusMembers)} campus members`}
                    />
                    <Metric
                      label="Average level"
                      value={formatLevel(data.stats.averageLevel)}
                      hint={`top level ${formatLevel(data.stats.topLevel)}`}
                    />
                    <Metric
                      label="Past common core"
                      value={data.stats.pastCommonCore}
                      hint="transcenders & alumni"
                    />
                    <Metric
                      label="Building now"
                      value={data.stats.studentsBuilding}
                      hint={`${formatNumber(data.stats.projectsInProgress)} projects in progress`}
                    />
                    <Metric
                      label="Blackhole in 7 days"
                      value={data.stats.blackholeWithin7Days}
                      hint="students at the wire"
                    />
                  </MetricGroup>
                  <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                    <LevelDistributionChart bands={data.levelDistribution} />
                    <ActiveProjectsChart projects={data.activeProjects} />
                  </div>
                </>
              ),
              presence: (
                <>
                  <MetricGroup className="md:grid-cols-5">
                    <Metric label="On campus" value={data.pulse.studentsOnCampus} />
                    <ForecastMetrics forecast={view.forecast} today={today} />
                  </MetricGroup>
                  <div className="min-h-0 flex-1">
                    <PresenceBoard
                      presence={data.presence}
                      earliestLogin={data.earliestLogin}
                      topSessionThisWeek={data.topSessionThisWeek}
                      weekStart={data.weekStart}
                    />
                  </div>
                </>
              ),
              events: (
                <div className="grid min-h-0 flex-1 grid-rows-2 gap-3">
                  <EventsBoard events={view.events} />
                  <TeammateBoard
                    requests={view.teammates}
                    qrUrl={view.teammateUrl}
                  />
                </div>
              ),
              achievements: (
                <div className="min-h-0 flex-1">
                  <RecentPasses items={data.recentPasses} />
                </div>
              ),
              coalitions: (
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
              ),
              slides: (
                <div className="min-h-0 flex-1">
                  <SlideShow slides={view.slides} />
                </div>
              ),
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center border border-[var(--border)] bg-[var(--panel)] p-8 text-center">
            <div>
              <p className="text-lg">Campus data has not been ingested yet</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                The background job runs every 30 minutes; this screen fills in on
                its own.
              </p>
            </div>
          </div>
        )}
      </main>

      <AutoRefresh nextRefreshAt={view.nextRefreshAt} />
      <TeammateLiveUpdates />
      <ScreenAvailability hasSlides={view.slides.length > 0} />
      <PartnerLogos />
    </div>
  );
}
