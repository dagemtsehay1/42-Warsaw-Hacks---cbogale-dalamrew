import { pickDidYouKnow } from "@/data/campus-facts";
import { getDefaultCursusId, hasFortyTwoCredentials } from "@/lib/api/42/config";
import {
  fetchActiveLocations,
  fetchCampusBlocs,
  fetchCoalitionContributors,
  fetchCoalitionScoreEvents,
  fetchCoalitionsByBloc,
  fetchEarliestLocationToday,
  fetchProjectsUsers,
  fetchUsersByIds,
  resolveWarsawCampusId,
} from "@/lib/api/42/resources";
import { buildCoalitionScoreHistory } from "@/features/campus/coalition-history";
import type { FortyTwoCoalition, FortyTwoUser } from "@/lib/api/42/types";
import {
  toCoalitionContributor,
  toCoalitionSummary,
  toPresenceStudent,
  toProjectPass,
} from "@/lib/api/42/transforms";
import {
  coalitionDeltas,
  readLatestSnapshot,
  writeSnapshotIfDue,
  type CoalitionSnapshotEntry,
} from "@/lib/snapshots/campus";
import type {
  ActiveProjectStat,
  CampusPulse,
  CoalitionContributors,
  CoalitionScorePoint,
  DashboardPayload,
} from "@/types/campus";
import { startOfDay, startOfMonth } from "date-fns";

/**
 * Runs per-item fetches one at a time. The coalition screens need a handful of
 * calls per coalition, and firing them in parallel trips the 2 req/s limit — the
 * dashboard refreshes every 30 minutes, so trading latency for reliability is free.
 */
async function mapSequentially<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (const item of items) {
    try {
      results.push({ status: "fulfilled", value: await fn(item) });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }
  return results;
}

/** Students shown on the achievements screen's "Recently Passed" board. */
const RECENT_PASS_LIMIT = 20;

/**
 * How far back to look for validated projects. Wide enough that the board always
 * fills (Warsaw validates ~80 projects a week) and that "passed this month" can be
 * counted from the same fetch, which is why it also reaches back to the 1st.
 */
function passWindowStart(now = new Date()): Date {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return thirtyDaysAgo < startOfMonth(now) ? thirtyDaysAgo : startOfMonth(now);
}

/** In-progress work only counts as active if it has been touched recently. */
const ACTIVE_PROJECT_WINDOW_DAYS = 14;

function isToday(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= startOfDay(now);
}

function isThisMonth(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  return new Date(iso) >= startOfMonth(now);
}

function buildMockDashboard(): DashboardPayload {
  const now = new Date().toISOString();
  return {
    campusId: 0,
    campusName: "Warsaw",
    cursusId: 21,
    fetchedAt: now,
    pulse: {
      studentsOnCampus: 0,
      projectsPassedToday: 0,
      projectsPassedMonth: 0,
      activeProjects: 0,
    },
    recentPasses: [],
    activeProjects: [],
    presence: [],
    earliestLogin: null,
    coalitions: [],
    coalitionScoreHistory: [],
    coalitionContributors: [],
    didYouKnow: pickDidYouKnow(Date.now()),
    errors: ["42 API credentials are not configured"],
  };
}

export async function buildDashboardPayload(): Promise<DashboardPayload> {
  if (!hasFortyTwoCredentials()) {
    return buildMockDashboard();
  }

  const errors: string[] = [];
  const cursusId = getDefaultCursusId();
  const campus = await resolveWarsawCampusId();
  const campusId = campus.id;

  const [locationsResult, finishedResult, activeResult, blocsResult, todayLocationsResult] =
    await Promise.allSettled([
      fetchActiveLocations(campusId),
      fetchProjectsUsers({
        campusId,
        cursusId,
        status: "finished",
        marked: true,
        maxPages: 5,
        rangeField: "marked_at",
        since: passWindowStart(),
      }),
      fetchProjectsUsers({
        campusId,
        cursusId,
        status: "in_progress",
        maxPages: 2,
        rangeField: "updated_at",
        since: new Date(
          Date.now() - ACTIVE_PROJECT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        ),
      }),
      fetchCampusBlocs(campusId, cursusId),
      fetchEarliestLocationToday(campusId, startOfDay(new Date()).toISOString()),
    ]);

  const locations =
    locationsResult.status === "fulfilled" ? locationsResult.value : [];
  if (locationsResult.status === "rejected") {
    errors.push(`Presence: ${String(locationsResult.reason)}`);
  }

  const finished =
    finishedResult.status === "fulfilled" ? finishedResult.value : [];
  if (finishedResult.status === "rejected") {
    errors.push(`Recent passes: ${String(finishedResult.reason)}`);
  }

  const active =
    activeResult.status === "fulfilled" ? activeResult.value : [];
  if (activeResult.status === "rejected") {
    errors.push(`Active projects: ${String(activeResult.reason)}`);
  }

  const blocs = blocsResult.status === "fulfilled" ? blocsResult.value : [];
  if (blocsResult.status === "rejected") {
    errors.push(`Coalitions: ${String(blocsResult.reason)}`);
  }

  const todayLocations =
    todayLocationsResult.status === "fulfilled"
      ? todayLocationsResult.value
      : [];

  let coalitionsRaw: FortyTwoCoalition[] = [];
  if (blocs[0]) {
    try {
      coalitionsRaw = await fetchCoalitionsByBloc(blocs[0].id);
    } catch (error) {
      errors.push(`Coalition details: ${String(error)}`);
    }
  }

  const snapshotEntries: CoalitionSnapshotEntry[] = coalitionsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    score: c.score ?? 0,
  }));

  const previous = await readLatestSnapshot();
  const { previous: baseline } = await writeSnapshotIfDue({
    capturedAt: new Date().toISOString(),
    campusId,
    coalitions: snapshotEntries,
    metrics: {
      studentsOnCampus: locations.length,
      projectsPassedToday: finished.filter((p) => isToday(p.marked_at)).length,
    },
  });

  const deltas = coalitionDeltas(snapshotEntries, baseline ?? previous);
  const coalitions = coalitionsRaw
    .map((c) => toCoalitionSummary(c, deltas.get(c.id) ?? null))
    .sort((a, b) => b.score - a.score);

  const scoreEventResults = await mapSequentially(coalitions, (c) =>
    fetchCoalitionScoreEvents(c.id, c.score),
  );
  const contributorResults = await mapSequentially(coalitions, (c) =>
    fetchCoalitionContributors(c.id),
  );

  const coalitionScoreHistory: CoalitionScorePoint[] = buildCoalitionScoreHistory(
    coalitions.map((coalition, index) => {
      const result = scoreEventResults[index];
      if (result.status === "rejected") {
        errors.push(`Score history for ${coalition.name}: ${String(result.reason)}`);
        return { id: coalition.id, score: coalition.score, events: [] };
      }
      return { id: coalition.id, score: coalition.score, events: result.value };
    }),
  );
  const topByCoalition = coalitions.map((coalition, index) => {
    const result = contributorResults[index];
    if (result.status === "rejected") {
      errors.push(`Top contributors for ${coalition.name}: ${String(result.reason)}`);
      return { coalitionId: coalition.id, top: [] };
    }
    const top = [...result.value].sort((a, b) => b.score - a.score).slice(0, 3);
    return { coalitionId: coalition.id, top };
  });

  const contributorUserIds = [
    ...new Set(topByCoalition.flatMap((c) => c.top.map((t) => t.user_id))),
  ];
  let usersById = new Map<number, FortyTwoUser>();
  try {
    const users = await fetchUsersByIds(contributorUserIds);
    usersById = new Map(users.map((u) => [u.id, u]));
  } catch (error) {
    errors.push(`Contributor profiles: ${String(error)}`);
  }

  const coalitionContributors: CoalitionContributors[] = topByCoalition.map(
    ({ coalitionId, top }) => ({
      coalitionId,
      contributors: top
        .map((item) => toCoalitionContributor(item, usersById))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    }),
  );

  // The window is fetched in API order, which is neither sorted nor filtered to
  // successes, so both have to happen here.
  const validatedPasses = finished
    .map((item) => toProjectPass(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.validated && item.markedAt)
    .sort(
      (a, b) =>
        new Date(b.markedAt as string).getTime() -
        new Date(a.markedAt as string).getTime(),
    );

  // One row per student: someone who validated four projects in the same window
  // would otherwise take four of the twenty slots.
  const recentPasses: typeof validatedPasses = [];
  const seenLogins = new Set<string>();
  for (const pass of validatedPasses) {
    if (seenLogins.has(pass.login)) continue;
    seenLogins.add(pass.login);
    recentPasses.push(pass);
    if (recentPasses.length === RECENT_PASS_LIMIT) break;
  }

  const projectMap = new Map<number, ActiveProjectStat>();
  for (const item of active) {
    const existing = projectMap.get(item.project.id);
    if (existing) {
      existing.studentCount += 1;
    } else {
      projectMap.set(item.project.id, {
        projectId: item.project.id,
        projectName: item.project.name,
        slug: item.project.slug,
        studentCount: 1,
      });
    }
  }

  const activeProjects = [...projectMap.values()]
    .sort((a, b) => b.studentCount - a.studentCount)
    .slice(0, 8);

  const presence = locations
    .map((loc) => toPresenceStudent(loc))
    .sort(
      (a, b) => new Date(a.beginAt).getTime() - new Date(b.beginAt).getTime(),
    );

  const earliestFromActive = presence[0] ?? null;
  const earliestFromToday =
    todayLocations.length > 0
      ? toPresenceStudent(
          [...todayLocations].sort(
            (a, b) =>
              new Date(a.begin_at).getTime() - new Date(b.begin_at).getTime(),
          )[0],
        )
      : null;
  const earliestLogin = earliestFromToday ?? earliestFromActive;

  // Counted off the validated list so the "Passed" labels stay true — `finished`
  // also contains failed attempts.
  const passedToday = validatedPasses.filter((p) => isToday(p.markedAt)).length;
  const passedMonth = validatedPasses.filter((p) =>
    isThisMonth(p.markedAt),
  ).length;

  const pulse: CampusPulse = {
    studentsOnCampus: presence.length,
    projectsPassedToday: passedToday,
    projectsPassedMonth: passedMonth,
    activeProjects: activeProjects.length,
  };

  return {
    campusId,
    campusName: campus.name,
    cursusId,
    fetchedAt: new Date().toISOString(),
    pulse,
    recentPasses,
    activeProjects,
    presence: presence.slice(0, 24),
    earliestLogin,
    coalitions,
    coalitionScoreHistory,
    coalitionContributors,
    didYouKnow: pickDidYouKnow(campusId + new Date().getDate()),
    errors,
  };
}
