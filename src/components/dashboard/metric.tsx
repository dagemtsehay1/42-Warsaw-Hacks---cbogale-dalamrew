import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

export function Metric({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  className?: string;
}) {
  const display =
    typeof value === "number" ? formatNumber(value) : (value ?? "—");

  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] md:text-xs">
        {label}
      </div>
      <div className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)] md:text-4xl lg:text-5xl">
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
