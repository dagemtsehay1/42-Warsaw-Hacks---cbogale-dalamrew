import type { LevelBandStat } from "@/types/campus";
import { levelRampColor } from "@/lib/charts/palette";
import { formatNumber, formatPercent } from "@/lib/utils/format";

/** Donut geometry, in the SVG's own units. */
const SIZE = 200;
const RADIUS = 78;
const THICKNESS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The 2px surface gap between wedges, expressed in SVG units. */
const GAP = 2.2;

type Wedge = { id: string; color: string; dash: number; offset: number };

/** Each wedge as one dash of the stroked circle, laid end to end. */
function toWedges(bands: LevelBandStat[], total: number): Wedge[] {
  const wedges: Wedge[] = [];
  let offset = 0;

  for (const band of bands) {
    if (band.studentCount <= 0) continue;
    const length = (band.studentCount / total) * CIRCUMFERENCE;
    wedges.push({
      id: band.id,
      color: levelRampColor(band.level),
      // The gap is taken out of the wedge, so neighbours never touch.
      dash: Math.max(length - GAP, 0.5),
      offset,
    });
    offset += length;
  }

  return wedges;
}

/**
 * Students per cursus level, drawn as a server-rendered donut.
 *
 * Plain SVG rather than a charting library: this is a passive display, the data
 * only changes when the page re-renders, and nobody hovers a wall-mounted TV —
 * so shipping a chart runtime to the browser would buy nothing. Each wedge is
 * one dash of a stroked circle, which is exactly what a donut is.
 */
export function LevelDistributionChart({ bands }: { bands: LevelBandStat[] }) {
  const total = bands.reduce((sum, band) => sum + band.studentCount, 0);

  if (total === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <Heading />
        </header>
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Cursus levels unavailable right now.
        </div>
      </section>
    );
  }

  const wedges = toWedges(bands, total);

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <Heading />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-6 p-4">
        <div className="relative aspect-square h-full max-h-[min(100%,22rem)] shrink-0">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-full w-full"
            role="img"
            aria-label={`Students by cursus level, ${formatNumber(total)} in total`}
          >
            {/* Rotated so the first band starts at twelve o'clock. */}
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {wedges.map((wedge) => (
                <circle
                  key={wedge.id}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={wedge.color}
                  strokeWidth={THICKNESS}
                  strokeDasharray={`${wedge.dash} ${CIRCUMFERENCE - wedge.dash}`}
                  strokeDashoffset={-wedge.offset}
                />
              ))}
            </g>
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-4xl font-semibold text-[var(--foreground)]">
              {formatNumber(total)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Students
            </div>
          </div>
        </div>

        {/* The legend doubles as the table view: every band, empty ones included. */}
        <ul className="flex shrink-0 flex-col justify-center gap-1.5">
          {bands.map((band) => (
            <li key={band.id} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-3 w-3 shrink-0"
                style={{ backgroundColor: levelRampColor(band.level) }}
                aria-hidden
              />
              <span className="w-24 text-[var(--muted)]">{band.label}</span>
              <span className="w-10 text-right font-mono tabular-nums text-[var(--foreground)]">
                {formatNumber(band.studentCount)}
              </span>
              <span className="w-10 text-right font-mono tabular-nums text-[var(--muted)]">
                {formatPercent((band.studentCount / total) * 100)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Heading() {
  return (
    <>
      <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        Common Core Progress
      </h2>
      <p className="text-xs text-[var(--muted)]">
        Students by cursus level — intra exposes no milestone field, so level is
        the progress measure
      </p>
    </>
  );
}
