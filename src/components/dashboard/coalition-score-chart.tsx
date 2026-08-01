"use client";

import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CoalitionScorePoint, CoalitionSummary } from "@/types/campus";
import { formatClock, formatNumber, formatShortDay } from "@/lib/utils/format";

type ChartRow = { capturedAt: string; [coalitionId: string]: string | number | null };

export function CoalitionScoreChart({
  history,
  coalitions,
}: {
  history: CoalitionScorePoint[];
  coalitions: CoalitionSummary[];
}) {
  // Only coalitions the ledger actually covers are plotted; the rest would be flat lines.
  const plotted = coalitions.filter((c) =>
    history.some((point) => point.scoresByCoalitionId[c.id] != null),
  );

  if (history.length < 2 || plotted.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)] p-6">
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Coalition Battle
        </h2>
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Score history unavailable for this campus right now.
        </div>
      </section>
    );
  }

  const data: ChartRow[] = history.map((point) => ({
    capturedAt: point.capturedAt,
    ...Object.fromEntries(
      plotted.map((c) => [c.id, point.scoresByCoalitionId[c.id] ?? null]),
    ),
  }));

  const coalitionByKey = new Map(plotted.map((c) => [String(c.id), c]));
  const lastCapturedAt = history[history.length - 1]?.capturedAt;

  // Fit the axis to the race rather than anchoring at zero: these are all large,
  // similar totals, and a 0-based axis squashes a week of movement into a flat band.
  const values = history.flatMap((point) =>
    plotted.map((c) => point.scoresByCoalitionId[c.id]).filter((v): v is number => v != null),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(Math.round((max - min) * 0.15), 100);
  const domain: [number, number] = [
    Math.max(0, Math.floor((min - pad) / 1000) * 1000),
    Math.ceil((max + pad) / 1000) * 1000,
  ];

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Coalition Battle
        </h2>
        <p className="text-xs text-[var(--muted)]">
          This season, reconstructed from the coalition score ledger
        </p>
      </header>
      <div className="min-h-0 flex-1 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
            <XAxis
              dataKey="capturedAt"
              tickFormatter={(value) =>
                value === lastCapturedAt
                  ? "Now"
                  : formatShortDay(new Date(value as string))
              }
              stroke="var(--border)"
              tick={{ fill: "var(--muted)", fontSize: 14 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--border)"
              tick={{ fill: "var(--muted)", fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              width={72}
              domain={domain}
              tickFormatter={(value) => formatNumber(value as number)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--panel-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                fontSize: 13,
              }}
              labelFormatter={(label) => {
                const date = new Date(label as string);
                return `${formatShortDay(date)} ${formatClock(date)}`;
              }}
              formatter={(value, name) => {
                const coalition = coalitionByKey.get(String(name));
                return [formatNumber(value as number), coalition?.name ?? String(name)];
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                const coalition = coalitionByKey.get(String(value));
                return (
                  <span className="font-mono text-sm text-[var(--foreground)]">
                    {coalition?.name ?? String(value)}
                  </span>
                );
              }}
            />
            {plotted.map((coalition) => (
              <Line
                key={coalition.id}
                type="linear"
                dataKey={String(coalition.id)}
                name={String(coalition.id)}
                stroke={coalition.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
