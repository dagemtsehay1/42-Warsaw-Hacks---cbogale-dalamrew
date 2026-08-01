import type { CoalitionScorePoint, CoalitionSummary } from "@/types/campus";
import { formatNumber, formatShortDay } from "@/lib/utils/format";

/** Plot area in SVG units; the viewBox is stretched to the panel. */
const WIDTH = 1000;
const HEIGHT = 420;
const PADDING = { top: 16, right: 24, bottom: 34, left: 84 };

/**
 * Each coalition's season-to-date score, server-rendered as an SVG polyline.
 *
 * The chart used to be a recharts `LineChart`; on a passive display its
 * interactivity was never reachable, so the whole runtime is gone and the same
 * picture is drawn from the same data on the server. Colors stay each
 * coalition's own brand color, and the Y axis is still fitted to the race rather
 * than anchored at zero.
 */
export function CoalitionScoreChart({
  history,
  coalitions,
}: {
  history: CoalitionScorePoint[];
  coalitions: CoalitionSummary[];
}) {
  // Only coalitions the ledger actually covers are plotted; the rest would be
  // flat lines.
  const plotted = coalitions.filter((c) =>
    history.some((point) => point.scoresByCoalitionId[c.id] != null),
  );

  if (history.length < 2 || plotted.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)] p-6">
        <Heading />
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Score history unavailable for this campus right now.
        </div>
      </section>
    );
  }

  const values = history.flatMap((point) =>
    plotted
      .map((c) => point.scoresByCoalitionId[c.id])
      .filter((v): v is number => v != null),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(Math.round((max - min) * 0.15), 100);
  const domain: [number, number] = [
    Math.max(0, Math.floor((min - pad) / 1000) * 1000),
    Math.ceil((max + pad) / 1000) * 1000,
  ];

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (index: number) =>
    PADDING.left +
    (history.length === 1
      ? plotWidth / 2
      : (index / (history.length - 1)) * plotWidth);
  const y = (value: number) =>
    PADDING.top +
    plotHeight -
    ((value - domain[0]) / (domain[1] - domain[0] || 1)) * plotHeight;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => domain[0] + (domain[1] - domain[0]) * t,
  );
  // First, middle and last stamp: enough to date the race without crowding.
  const xTickIndexes = [0, Math.floor((history.length - 1) / 2), history.length - 1];

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <Heading />
      </header>

      <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 pt-3">
        {plotted.map((coalition) => (
          <li key={coalition.id} className="flex items-center gap-2">
            <span
              className="h-0.5 w-5"
              style={{ backgroundColor: coalition.color }}
              aria-hidden
            />
            <span className="font-mono text-sm text-[var(--foreground)]">
              {coalition.name}
            </span>
            <span className="font-mono text-sm tabular-nums text-[var(--muted)]">
              {formatNumber(coalition.score)}
            </span>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 p-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="Coalition scores this season"
        >
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              {/* `preserveAspectRatio="none"` stretches the viewBox, so text is
                  placed with a plain font-size and left unscaled by the browser. */}
              <text
                x={PADDING.left - 12}
                y={y(value) + 5}
                textAnchor="end"
                fill="var(--muted)"
                fontSize={16}
                fontFamily="var(--font-mono)"
              >
                {formatNumber(Math.round(value))}
              </text>
            </g>
          ))}

          {xTickIndexes.map((index, position) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor={
                position === 0 ? "start" : position === 2 ? "end" : "middle"
              }
              fill="var(--muted)"
              fontSize={16}
            >
              {position === 2
                ? "Now"
                : formatShortDay(new Date(history[index].capturedAt))}
            </text>
          ))}

          {plotted.map((coalition) => {
            const points = history
              .map((point, index) => {
                const value = point.scoresByCoalitionId[coalition.id];
                return value == null ? null : `${x(index)},${y(value)}`;
              })
              .filter((p): p is string => p != null)
              .join(" ");

            return (
              <polyline
                key={coalition.id}
                points={points}
                fill="none"
                stroke={coalition.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function Heading() {
  return (
    <>
      <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        Coalition Battle
      </h2>
      <p className="text-xs text-[var(--muted)]">
        This season, reconstructed from the coalition score ledger
      </p>
    </>
  );
}
