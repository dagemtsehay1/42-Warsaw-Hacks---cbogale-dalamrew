"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LevelBandStat } from "@/types/campus";
import { levelRampColor } from "@/lib/charts/palette";
import { formatNumber, formatPercent } from "@/lib/utils/format";

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

  // Empty bands are dropped from the wedge data (a zero-value slice draws a
  // hairline artifact at its start angle) but stay in the legend, which is where
  // "nobody is at level 6 yet" is a readable fact rather than a rendering glitch.
  const plotted = bands.filter((band) => band.studentCount > 0);

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <Heading />
      </header>

      <div className="flex min-h-0 flex-1 items-center gap-4 p-4">
        <div className="relative h-full min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={plotted}
                dataKey="studentCount"
                nameKey="label"
                innerRadius="58%"
                outerRadius="92%"
                startAngle={90}
                endAngle={-270}
                // The 2px surface-colored ring is the gap between wedges — the
                // separator is negative space, not a drawn border.
                stroke="var(--panel)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {plotted.map((band) => (
                  <Cell key={band.id} fill={levelRampColor(band.level)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--panel-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  fontSize: 13,
                }}
                formatter={(value, name) => [
                  `${formatNumber(value as number)} students`,
                  String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre of the donut carries the total the wedges add up to. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-4xl font-semibold text-[var(--foreground)]">
              {formatNumber(total)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Students
            </div>
          </div>
        </div>

        {/* Legend doubles as the table view: every band, including empty ones. */}
        <ul className="flex shrink-0 flex-col justify-center gap-1.5 pr-2">
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
