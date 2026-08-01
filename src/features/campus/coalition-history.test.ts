import { startOfDay } from "date-fns";
import { describe, expect, it } from "vitest";
import { buildCoalitionScoreHistory } from "@/features/campus/coalition-history";

const NOW = new Date("2026-07-29T12:00:00.000Z");
const daysAgo = (n: number, hour = 10) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().replace(/T\d\d/, `T${String(hour).padStart(2, "0")}`);

describe("buildCoalitionScoreHistory", () => {
  it("reconstructs past scores by subtracting later events from the current total", () => {
    const history = buildCoalitionScoreHistory(
      [
        {
          id: 1,
          score: 1000,
          events: [
            { value: 100, created_at: daysAgo(0) },
            { value: 50, created_at: daysAgo(1) },
            { value: 25, created_at: daysAgo(5) },
          ],
        },
      ],
      { now: NOW },
    );

    expect(history[history.length - 1].scoresByCoalitionId[1]).toBe(1000);

    // Day boundaries are campus-local, so derive the expected timestamp the same way.
    // Before today's +100 landed, the total was 900.
    const startOfToday = history.find(
      (p) => p.capturedAt === startOfDay(NOW).toISOString(),
    );
    expect(startOfToday?.scoresByCoalitionId[1]).toBe(900);

    // Scores never decrease across a window of positive-only events.
    const series = history.map((p) => p.scoresByCoalitionId[1]);
    expect([...series].sort((a, b) => a - b)).toEqual(series);
  });

  it("spans the whole ledger, not a fixed week", () => {
    const history = buildCoalitionScoreHistory(
      [
        {
          id: 1,
          score: 500,
          events: [
            { value: 10, created_at: daysAgo(40) },
            { value: 10, created_at: daysAgo(2) },
          ],
        },
      ],
      { now: NOW },
    );

    const spanDays =
      (new Date(history[history.length - 1].capturedAt).getTime() -
        new Date(history[0].capturedAt).getTime()) /
      86_400_000;
    expect(spanDays).toBeGreaterThan(30);
  });

  it("drops points that reach back past a season reset", () => {
    // Events sum to far more than the current score, as they do across a real
    // reset — every point before the reset would reconstruct negative.
    const history = buildCoalitionScoreHistory(
      [
        {
          id: 1,
          score: 100,
          events: [
            { value: 60, created_at: daysAgo(1) },
            { value: 40, created_at: daysAgo(3) },
            { value: 5000, created_at: daysAgo(20) },
          ],
        },
      ],
      { now: NOW },
    );

    expect(history.length).toBeGreaterThan(0);
    for (const point of history) {
      expect(point.scoresByCoalitionId[1]).toBeGreaterThanOrEqual(0);
    }
    // The pre-reset spike must not drag the chart back 20 days.
    const spanDays =
      (new Date(history[history.length - 1].capturedAt).getTime() -
        new Date(history[0].capturedAt).getTime()) /
      86_400_000;
    expect(spanDays).toBeLessThan(20);
  });

  it("keeps every coalition on the same set of timestamps", () => {
    const history = buildCoalitionScoreHistory(
      [
        { id: 1, score: 500, events: [{ value: 10, created_at: daysAgo(1) }] },
        { id: 2, score: 800, events: [{ value: 20, created_at: daysAgo(2) }] },
      ],
      { now: NOW },
    );

    for (const point of history) {
      expect(Object.keys(point.scoresByCoalitionId).sort()).toEqual(["1", "2"]);
    }
  });

  it("clamps the window to what the ledger actually covers", () => {
    const history = buildCoalitionScoreHistory(
      [{ id: 1, score: 300, events: [{ value: 5, created_at: daysAgo(2) }] }],
      { now: NOW },
    );

    const earliest = new Date(history[0].capturedAt).getTime();
    expect(earliest).toBeGreaterThanOrEqual(new Date(daysAgo(2)).getTime() - 86_400_000);
  });

  it("omits a coalition with no ledger data instead of drawing it flat", () => {
    const history = buildCoalitionScoreHistory(
      [
        { id: 1, score: 500, events: [{ value: 10, created_at: daysAgo(1) }] },
        { id: 2, score: 900, events: [] },
      ],
      { now: NOW },
    );

    expect(history.length).toBeGreaterThan(0);
    for (const point of history) {
      expect(point.scoresByCoalitionId).toHaveProperty("1");
      expect(point.scoresByCoalitionId).not.toHaveProperty("2");
    }
  });

  it("returns nothing when no coalition has ledger events", () => {
    expect(
      buildCoalitionScoreHistory([{ id: 1, score: 100, events: [] }], {
        now: NOW,
      }),
    ).toEqual([]);
  });
});
