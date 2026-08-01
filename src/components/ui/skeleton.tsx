import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm bg-[var(--panel-elevated)]",
        className,
      )}
      aria-hidden
    />
  );
}
