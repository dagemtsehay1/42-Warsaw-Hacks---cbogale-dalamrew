import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

/** One CSS var per signal a tile can carry — same tokens used for the coalition
 *  and level-ramp colors elsewhere, so a tinted tile still reads as this app
 *  rather than a plugged-in theme. */
const TONES = {
  accent: "var(--accent)",
  blue: "var(--accent-blue)",
  violet: "var(--accent-violet)",
  green: "var(--accent-green)",
  danger: "var(--danger)",
} as const;

export type MetricTone = keyof typeof TONES;

export function Metric({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  /** Colors the number and the tile's edge. Omit for the plain neutral tile. */
  tone?: MetricTone;
  className?: string;
}) {
  const display =
    typeof value === "number" ? formatNumber(value) : (value ?? "—");
  const toneColor = tone ? TONES[tone] : undefined;

  return (
    <div
      className={cn("min-w-0", tone && "border-l-2 pl-3", className)}
      style={toneColor ? { borderLeftColor: toneColor } : undefined}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] md:text-xs">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)] md:text-4xl lg:text-5xl"
        style={toneColor ? { color: toneColor } : undefined}
      >
        {display}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>
      ) : null}
    </div>
  );
}

export function MetricGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 border border-[var(--border)] bg-[var(--panel)] p-4 md:grid-cols-4 md:gap-6 md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
