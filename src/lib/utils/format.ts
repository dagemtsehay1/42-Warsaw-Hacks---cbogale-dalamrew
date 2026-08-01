export function formatLevel(level: number | undefined | null): string {
  if (level == null || Number.isNaN(level)) return "—";
  return level.toFixed(2);
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatPercent(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatRelativeTime(date: Date | string, now = new Date()): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** How long a session has been running, e.g. "9h 12m" or "42m". */
export function formatSessionLength(from: Date | string, now = Date.now()): string {
  const start = typeof from === "string" ? new Date(from) : from;
  const minutes = Math.max(0, Math.floor((now - start.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/**
 * Short axis label for a multi-week series, e.g. "29 Jul". Includes the month
 * because a weekday+day label repeats every week over a season-long range.
 */
export function formatShortDay(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
