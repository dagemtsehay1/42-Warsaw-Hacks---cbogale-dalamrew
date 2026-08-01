import type { DashboardPayload } from "@/types/campus";

/**
 * Fills the gaps in a partially-failed ingest from the previous snapshot.
 *
 * `buildDashboardPayload()` soft-fails per section, which keeps the *page* alive
 * but would still put an empty coalitions screen on the wall the moment one 42
 * API call comes back 429 — and one usually does eventually. These sections move
 * slowly (coalition scores over days, the level distribution over weeks), so
 * showing the last known value beats showing nothing.
 *
 * **Presence is deliberately never carried forward.** "Who is on campus now" is
 * the one thing on the board that is only true at the moment it was fetched;
 * half-hour-old faces would be a lie, an empty list is merely a gap.
 */
export function mergeSnapshotWithPrevious(
  next: DashboardPayload,
  previous: DashboardPayload | null,
): DashboardPayload {
  if (!previous) return next;

  const merged: DashboardPayload = { ...next };
  const carried: string[] = [];

  const carry = (label: string, apply: () => void, isMissing: boolean) => {
    if (!isMissing) return;
    apply();
    carried.push(label);
  };

  carry(
    "coalitions",
    () => {
      merged.coalitions = previous.coalitions;
      merged.coalitionScoreHistory = previous.coalitionScoreHistory;
      merged.coalitionContributors = previous.coalitionContributors;
    },
    next.coalitions.length === 0 && previous.coalitions.length > 0,
  );

  carry(
    "recent passes",
    () => {
      merged.recentPasses = previous.recentPasses;
    },
    next.recentPasses.length === 0 && previous.recentPasses.length > 0,
  );

  carry(
    "active projects",
    () => {
      merged.activeProjects = previous.activeProjects;
      merged.pulse = { ...merged.pulse, activeProjects: previous.pulse.activeProjects };
      merged.stats = {
        ...merged.stats,
        studentsBuilding: previous.stats.studentsBuilding,
        projectsInProgress: previous.stats.projectsInProgress,
      };
    },
    next.activeProjects.length === 0 && previous.activeProjects.length > 0,
  );

  carry(
    "campus stats",
    () => {
      merged.stats = {
        ...previous.stats,
        // Whatever the in-progress fetch just returned still applies.
        studentsBuilding: merged.stats.studentsBuilding,
        projectsInProgress: merged.stats.projectsInProgress,
      };
      merged.levelDistribution = previous.levelDistribution;
    },
    next.stats.studentsInCursus === 0 && previous.stats.studentsInCursus > 0,
  );

  carry(
    "hall of fame",
    () => {
      merged.topSessionThisWeek = previous.topSessionThisWeek;
      merged.weekStart = previous.weekStart;
    },
    next.topSessionThisWeek == null && previous.topSessionThisWeek != null,
  );

  if (carried.length > 0) {
    merged.errors = [
      ...next.errors,
      `Kept previous data for: ${carried.join(", ")}`,
    ];
  }

  return merged;
}
