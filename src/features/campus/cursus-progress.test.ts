import { describe, expect, it } from "vitest";
import {
  buildCampusStats,
  buildLevelDistribution,
  currentLearners,
  TOP_LEVEL_BAND,
} from "@/features/campus/cursus-progress";
import type { FortyTwoCursusUser } from "@/lib/api/42/types";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const daysFromNow = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

let nextId = 1;
function learner(overrides: Partial<FortyTwoCursusUser> = {}): FortyTwoCursusUser {
  const id = nextId++;
  return {
    id,
    cursus_id: 21,
    level: 3.5,
    grade: "Cadet",
    begin_at: "2026-01-01T00:00:00.000Z",
    end_at: null,
    blackholed_at: daysFromNow(90),
    user: {
      id,
      login: `student${id}`,
      first_name: "Test",
      last_name: "Student",
      image: {},
    },
    ...overrides,
  };
}

const extras = {
  campusMembers: 1554,
  studentsBuilding: 0,
  projectsInProgress: 0,
};

describe("currentLearners", () => {
  it("keeps students who are still in the cursus", () => {
    const rows = [
      learner(),
      learner({ blackholed_at: null }),
      learner({ blackholed_at: daysFromNow(1) }),
    ];
    expect(currentLearners(rows, NOW)).toHaveLength(3);
  });

  it("drops finished, blackholed and staff enrolments", () => {
    const rows = [
      learner(),
      learner({ end_at: "2026-06-01T00:00:00.000Z" }),
      learner({ blackholed_at: daysFromNow(-1) }),
      learner({ user: { ...learner().user, "staff?": true } }),
    ];

    const kept = currentLearners(rows, NOW);
    expect(kept).toHaveLength(1);
    expect(kept[0].end_at).toBeNull();
  });
});

describe("buildLevelDistribution", () => {
  it("buckets students by whole level and keeps empty bands", () => {
    const bands = buildLevelDistribution([
      learner({ level: 0 }),
      learner({ level: 0.99 }),
      learner({ level: 1.2 }),
      learner({ level: 3.5 }),
    ]);

    expect(bands).toHaveLength(TOP_LEVEL_BAND + 1);
    expect(bands.map((b) => b.studentCount)).toEqual([2, 1, 0, 1, 0, 0, 0, 0]);
    expect(bands[0].label).toBe("Level 0–1");
  });

  it("collects everyone above the top band together", () => {
    const bands = buildLevelDistribution([
      learner({ level: 7 }),
      learner({ level: 9.4 }),
      learner({ level: 19.95 }),
    ]);

    const top = bands[TOP_LEVEL_BAND];
    expect(top.label).toBe("Level 7+");
    expect(top.studentCount).toBe(3);
  });
});

describe("buildCampusStats", () => {
  it("summarises levels, grades and imminent blackholes", () => {
    const stats = buildCampusStats(
      [
        learner({ level: 2, blackholed_at: daysFromNow(3) }),
        learner({ level: 4, blackholed_at: daysFromNow(8) }),
        learner({ level: 12, grade: "Transcender", blackholed_at: null }),
        learner({ level: 18, grade: "Alumni", blackholed_at: null }),
      ],
      { ...extras, studentsBuilding: 120, projectsInProgress: 24 },
      NOW,
    );

    expect(stats.studentsInCursus).toBe(4);
    expect(stats.averageLevel).toBe(9);
    expect(stats.topLevel).toBe(18);
    expect(stats.pastCommonCore).toBe(2);
    expect(stats.blackholeWithin7Days).toBe(1);
    expect(stats.studentsBuilding).toBe(120);
    expect(stats.projectsInProgress).toBe(24);
    expect(stats.campusMembers).toBe(1554);
  });

  it("does not divide by zero when the fetch came back empty", () => {
    const stats = buildCampusStats([], extras, NOW);
    expect(stats.averageLevel).toBe(0);
    expect(stats.topLevel).toBe(0);
  });
});
