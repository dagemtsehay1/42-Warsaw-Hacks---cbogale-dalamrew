import { describe, expect, it } from "vitest";
import { mergeSnapshotWithPrevious } from "@/features/campus/snapshot-merge";
import type {
  CoalitionSummary,
  DashboardPayload,
  PresenceStudent,
} from "@/types/campus";

const coalition: CoalitionSummary = {
  id: 1,
  name: "Lunaria",
  slug: "lunaria",
  color: "#00b7ff",
  score: 43_043,
};

const student: PresenceStudent = {
  login: "dtarasov",
  displayName: "D T",
  host: "c2r1s4",
  beginAt: "2026-08-01T07:56:00.000Z",
};

function payload(overrides: Partial<DashboardPayload> = {}): DashboardPayload {
  return {
    campusId: 67,
    campusName: "Warsaw",
    cursusId: 21,
    fetchedAt: "2026-08-01T18:53:00.000Z",
    pulse: {
      studentsOnCampus: 27,
      projectsPassedToday: 0,
      projectsPassedMonth: 0,
      activeProjects: 34,
    },
    stats: {
      studentsInCursus: 266,
      campusMembers: 1554,
      averageLevel: 4.16,
      topLevel: 19.95,
      pastCommonCore: 38,
      blackholeWithin7Days: 4,
      studentsBuilding: 86,
      projectsInProgress: 34,
    },
    levelDistribution: [
      { id: "lvl-0", label: "Level 0–1", level: 0, studentCount: 23 },
    ],
    recentPasses: [],
    activeProjects: [
      { projectId: 1, projectName: "ft_printf", slug: "ft_printf", studentCount: 20 },
    ],
    presence: [student],
    earliestLogin: student,
    weekStart: "2026-07-25T22:00:00.000Z",
    topSessionThisWeek: { ...student, endAt: null, durationMs: 46_080_092 },
    coalitions: [coalition],
    coalitionScoreHistory: [
      { capturedAt: "2026-08-01T00:00:00.000Z", scoresByCoalitionId: { 1: 43_043 } },
    ],
    coalitionContributors: [{ coalitionId: 1, contributors: [] }],
    didYouKnow: "fact",
    errors: [],
    ...overrides,
  };
}

describe("mergeSnapshotWithPrevious", () => {
  it("returns the new payload untouched when there is nothing to fall back on", () => {
    const next = payload();
    expect(mergeSnapshotWithPrevious(next, null)).toEqual(next);
  });

  it("keeps a section that just failed", () => {
    const next = payload({
      coalitions: [],
      coalitionScoreHistory: [],
      coalitionContributors: [],
      errors: ["Coalition details: FortyTwoApiError: Too Many Requests"],
    });

    const merged = mergeSnapshotWithPrevious(next, payload());

    expect(merged.coalitions).toHaveLength(1);
    expect(merged.coalitionScoreHistory).toHaveLength(1);
    expect(merged.errors).toEqual([
      "Coalition details: FortyTwoApiError: Too Many Requests",
      "Kept previous data for: coalitions",
    ]);
  });

  it("never carries presence forward — an empty room beats a stale one", () => {
    const merged = mergeSnapshotWithPrevious(
      payload({ presence: [], earliestLogin: null }),
      payload(),
    );

    expect(merged.presence).toEqual([]);
    expect(merged.earliestLogin).toBeNull();
  });

  it("keeps the fresh value when the new fetch worked", () => {
    const next = payload({
      coalitions: [{ ...coalition, score: 44_000 }],
    });

    const merged = mergeSnapshotWithPrevious(next, payload());

    expect(merged.coalitions[0].score).toBe(44_000);
    expect(merged.errors).toEqual([]);
  });

  it("carries the cursus stats but keeps the in-progress numbers it did fetch", () => {
    const next = payload({
      stats: {
        studentsInCursus: 0,
        campusMembers: 0,
        averageLevel: 0,
        topLevel: 0,
        pastCommonCore: 0,
        blackholeWithin7Days: 0,
        studentsBuilding: 90,
        projectsInProgress: 30,
      },
      levelDistribution: [],
    });

    const merged = mergeSnapshotWithPrevious(next, payload());

    expect(merged.stats.studentsInCursus).toBe(266);
    expect(merged.stats.studentsBuilding).toBe(90);
    expect(merged.stats.projectsInProgress).toBe(30);
    expect(merged.levelDistribution).toHaveLength(1);
  });
});
