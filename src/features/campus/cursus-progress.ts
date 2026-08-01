import type { FortyTwoCursusUser } from "@/lib/api/42/types";
import type { CampusStats, LevelBandStat } from "@/types/campus";

/**
 * `/v2/cursus/:id/cursus_users` returns every enrolment the campus has ever had
 * — Warsaw's ~575 rows are years of students, most of them long finished or
 * blackholed, plus a handful of staff enrolments. A distribution built on all of
 * them describes the campus's history rather than the people in the building, so
 * everything on this screen is counted off the current learners only:
 *
 * - no `end_at` (still in the cursus),
 * - `blackholed_at` in the future or absent (the blackhole hasn't eaten them),
 * - not staff.
 */
export function currentLearners(
  rows: FortyTwoCursusUser[],
  now = new Date(),
): FortyTwoCursusUser[] {
  return rows.filter(
    (row) =>
      !row.user?.["staff?"] &&
      !row.end_at &&
      (!row.blackholed_at || new Date(row.blackholed_at) > now),
  );
}

/** Everything at this level and above lands in the top band. */
export const TOP_LEVEL_BAND = 7;

/**
 * Students bucketed into one band per whole level.
 *
 * Intra groups the common core into milestones 0–6, but **no API field exposes a
 * student's milestone** — not on `cursus_users`, and not on `/v2/projects`, whose
 * only grouping fields are `difficulty` and `parent`. Level is not a stand-in
 * either: Warsaw has Cadets (still inside the common core) as high as level 9
 * against Transcenders at 14+, so any level→milestone table would be invented.
 * The chart therefore bands the one progress measure the API does publish.
 */
export function buildLevelDistribution(
  learners: FortyTwoCursusUser[],
): LevelBandStat[] {
  const counts = new Array<number>(TOP_LEVEL_BAND + 1).fill(0);

  for (const row of learners) {
    const level = Number.isFinite(row.level) ? row.level : 0;
    const band = Math.min(Math.max(Math.floor(level), 0), TOP_LEVEL_BAND);
    counts[band] += 1;
  }

  return counts.map((studentCount, level) => ({
    id: `lvl-${level}`,
    label: level === TOP_LEVEL_BAND ? `Level ${level}+` : `Level ${level}–${level + 1}`,
    level,
    studentCount,
  }));
}

/**
 * Grades that mean the common core is done. Level can't answer this (see
 * `buildLevelDistribution`), but grade can — intra promotes a student out of
 * "Cadet" when they finish.
 */
const POST_COMMON_CORE_GRADES = new Set(["transcender", "alumni"]);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function buildCampusStats(
  learners: FortyTwoCursusUser[],
  extras: {
    campusMembers: number;
    studentsBuilding: number;
    projectsInProgress: number;
  },
  now = new Date(),
): CampusStats {
  const levels = learners.map((row) =>
    Number.isFinite(row.level) ? row.level : 0,
  );
  const horizon = new Date(now.getTime() + SEVEN_DAYS_MS);

  return {
    studentsInCursus: learners.length,
    campusMembers: extras.campusMembers,
    averageLevel: levels.length
      ? levels.reduce((sum, level) => sum + level, 0) / levels.length
      : 0,
    topLevel: levels.length ? Math.max(...levels) : 0,
    pastCommonCore: learners.filter((row) =>
      POST_COMMON_CORE_GRADES.has((row.grade ?? "").toLowerCase()),
    ).length,
    blackholeWithin7Days: learners.filter(
      (row) => row.blackholed_at && new Date(row.blackholed_at) <= horizon,
    ).length,
    studentsBuilding: extras.studentsBuilding,
    projectsInProgress: extras.projectsInProgress,
  };
}
