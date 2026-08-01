import { describe, expect, it } from "vitest";
import {
  coalitionDeltas,
  diffCoalitionScores,
  type CampusSnapshot,
} from "@/lib/snapshots/campus";

describe("snapshot deltas", () => {
  const previous: CampusSnapshot = {
    capturedAt: "2026-07-27T10:00:00.000Z",
    campusId: 1,
    coalitions: [
      { id: 1, name: "A", score: 100 },
      { id: 2, name: "B", score: 200 },
    ],
  };

  it("computes coalition deltas without inventing history", () => {
    const current = [
      { id: 1, name: "A", score: 140 },
      { id: 2, name: "B", score: 180 },
      { id: 3, name: "C", score: 50 },
    ];
    const deltas = coalitionDeltas(current, previous);
    expect(deltas.get(1)).toBe(40);
    expect(deltas.get(2)).toBe(-20);
    expect(deltas.get(3)).toBeNull();
  });

  it("returns null deltas when no previous snapshot exists", () => {
    const result = diffCoalitionScores([{ id: 1, score: 10 }], null);
    expect(result[1]).toBeNull();
  });
});
