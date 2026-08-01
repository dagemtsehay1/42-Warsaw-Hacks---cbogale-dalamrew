/**
 * Chart colors for the campus-stats screen.
 *
 * The app renders on one surface only (`--panel`, #12161a), so there is a single
 * selected set rather than a light/dark pair.
 *
 * `LEVEL_RAMP` is an **ordinal** ramp — one hue (the 42 accent teal), stepping
 * lighter as the level rises, so the slices read as a scale rather than as eight
 * unrelated categories. It was validated against the panel surface (monotone
 * lightness, ≥0.06 OKLCH ΔL between adjacent steps, darkest step ≥2:1 contrast,
 * hue spread 1°); re-validate before changing a step.
 */
export const LEVEL_RAMP = [
  "#006263",
  "#007879",
  "#008f91",
  "#00a7a9",
  "#35bdbf",
  "#84cdce",
  "#b6dede",
  "#dff0f0",
] as const;

/** Single-series bars: one hue, no rank-coloring. Contrast 6.15:1 on `--panel`. */
export const SERIES_ACCENT = "#00a7a9";

export function levelRampColor(index: number): string {
  return LEVEL_RAMP[Math.min(Math.max(index, 0), LEVEL_RAMP.length - 1)];
}
