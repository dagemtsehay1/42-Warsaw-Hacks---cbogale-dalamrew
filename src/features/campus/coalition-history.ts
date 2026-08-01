import { startOfDay } from "date-fns";
import type { CoalitionScorePoint } from "@/types/campus";

const DAY_MS = 86_400_000;

export type ScoreEvent = {
  value: number;
  created_at: string;
};

export type CoalitionScoreInput = {
  id: number;
  score: number;
  events: ScoreEvent[];
};

/**
 * Rebuilds each coalition's score over the current season from the 42 score ledger.
 *
 * The API only exposes a coalition's *current* total plus an append-only list of
 * score events, so history is reconstructed backwards: the score at time T is the
 * current total minus every event recorded after T.
 *
 * Two things bound how far back that stays truthful:
 *
 * 1. **Season resets.** Coalition scores are wiped between seasons and the reset is
 *    not written to the ledger, so continuing backwards past it drives the
 *    reconstruction negative (the full 42 Warsaw ledger sums to ~12x the current
 *    score). Points that come out below zero are pre-reset and get dropped, which
 *    makes the chart start at the season boundary.
 * 2. **Fetch depth.** If the fetched pages don't reach the reset, earlier points
 *    would overstate the past score, so the window is clamped to what the events
 *    actually cover.
 *
 * A coalition whose ledger could not be fetched is left out of the series entirely:
 * with no events to subtract it would plot as a flat line at its current score,
 * which reads as "scored nothing all season" rather than "we have no data".
 */
export function buildCoalitionScoreHistory(
  coalitions: CoalitionScoreInput[],
  options?: { maxDays?: number; now?: Date },
): CoalitionScorePoint[] {
  const now = options?.now ?? new Date();
  const maxDays = options?.maxDays ?? 400;
  const withEvents = coalitions.filter((c) => c.events.length > 0);
  if (withEvents.length === 0) return [];

  // The earliest moment every series can account for.
  const earliestCovered = Math.max(
    ...withEvents.map((c) =>
      Math.min(...c.events.map((e) => new Date(e.created_at).getTime())),
    ),
  );
  const floor = startOfDay(new Date(now.getTime() - (maxDays - 1) * DAY_MS));
  const windowStart = Math.max(
    earliestCovered,
    Math.min(floor.getTime(), now.getTime()),
  );

  const boundaries: number[] = [];
  let cursor = startOfDay(new Date(windowStart)).getTime();
  // startOfDay can land before windowStart; step to the first whole day inside it.
  if (cursor < windowStart) cursor += DAY_MS;
  while (cursor <= now.getTime()) {
    boundaries.push(cursor);
    cursor += DAY_MS;
  }
  // Always finish on the live reading.
  boundaries.push(now.getTime());

  const points = boundaries.map((boundary) => ({
    capturedAt: new Date(boundary).toISOString(),
    scoresByCoalitionId: Object.fromEntries(
      withEvents.map((coalition) => {
        const gainedSince = coalition.events
          .filter((e) => new Date(e.created_at).getTime() > boundary)
          .reduce((sum, e) => sum + (e.value ?? 0), 0);
        return [coalition.id, coalition.score - gainedSince];
      }),
    ),
  }));

  // Drop the leading stretch that reaches back past the season reset.
  const firstValid = points.findIndex((point) =>
    Object.values(point.scoresByCoalitionId).every((score) => score >= 0),
  );
  return firstValid <= 0 ? points : points.slice(firstValid);
}
