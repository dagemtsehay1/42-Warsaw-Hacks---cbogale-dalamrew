"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActiveProjectStat } from "@/types/campus";
import { SERIES_ACCENT } from "@/lib/charts/palette";
import { formatNumber } from "@/lib/utils/format";

/** Project names run long ("ft_transcendence"); the axis gets a fixed gutter. */
const NAME_MAX_CHARS = 18;

export function ActiveProjectsChart({
  projects,
}: {
  projects: ActiveProjectStat[];
}) {
  if (!projects.length) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <Heading />
        </header>
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          No in-progress projects in the latest fetch.
        </div>
      </section>
    );
  }

  // Recharts draws the first row at the top of a vertical layout, so the
  // ascending sort puts the busiest project there.
  const data = [...projects].sort((a, b) => a.studentCount - b.studentCount);

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <Heading />
      </header>
      <div className="min-h-0 flex-1 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
            barCategoryGap="22%"
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="projectName"
              width={148}
              tick={{ fill: "var(--muted)", fontSize: 14 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => {
                const name = String(value);
                return name.length > NAME_MAX_CHARS
                  ? `${name.slice(0, NAME_MAX_CHARS - 1)}…`
                  : name;
              }}
            />
            <Tooltip
              cursor={{ fill: "var(--panel-hover)" }}
              contentStyle={{
                background: "var(--panel-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                fontSize: 13,
              }}
              formatter={(value) => [
                `${formatNumber(value as number)} students`,
                "In progress",
              ]}
            />
            <Bar
              dataKey="studentCount"
              fill={SERIES_ACCENT}
              // Rounded at the data end, square at the baseline.
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            >
              {/* One value per bar, at the tip — the axis carries no numbers. */}
              <LabelList
                dataKey="studentCount"
                position="right"
                offset={10}
                fill="var(--foreground)"
                fontSize={15}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Heading() {
  return (
    <>
      <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        What Campus Is Building
      </h2>
      <p className="text-xs text-[var(--muted)]">
        Students registered on each project, in progress in the last two weeks
      </p>
    </>
  );
}
