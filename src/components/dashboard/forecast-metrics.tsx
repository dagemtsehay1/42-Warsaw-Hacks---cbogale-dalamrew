import { Metric } from "@/components/dashboard/metric";
import { addDays } from "@/features/campus/attendance-forecast";
import type { DayForecast } from "@/types/campus";
import { formatNumber } from "@/lib/utils/format";

/** "Tue", "Wed" … for a campus-local `YYYY-MM-DD`, free of the server timezone. */
function weekdayLabel(date: string): string {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function tileLabel(date: string, offset: number): string {
  return offset === 1 ? "Estimated tomorrow" : `Estimated in ${weekdayLabel(date)}`;
}

/**
 * The three-day attendance outlook plus the busiest hour.
 *
 * Every number here was computed once, at midnight, from ~60 days of host
 * sessions and stored — so it is identical on every screen and does not shuffle
 * as the day goes on. `today` is the campus-local day the outlook was computed
 * for, which is also what the day labels are counted from.
 */
export function ForecastMetrics({
  forecast,
  today,
}: {
  forecast: DayForecast[];
  today: string;
}) {
  const byDate = new Map(forecast.map((day) => [day.targetDate, day]));
  const upcoming = [1, 2, 3].map((offset) => {
    const date = addDays(today, offset);
    return { offset, date, forecast: byDate.get(date) ?? null };
  });

  // The peak hour belongs to today: it is the hour this very day fills up.
  const peak = byDate.get(today) ?? null;

  return (
    <>
      {upcoming.map(({ offset, date, forecast: day }) => (
        <Metric
          key={date}
          label={tileLabel(date, offset)}
          value={day ? day.expected : "—"}
          hint={
            day
              ? `${formatNumber(day.low)}–${formatNumber(day.high)} · ${day.sampleDays} ${weekdayLabel(date)}s`
              : "not enough history yet"
          }
        />
      ))}
      <Metric
        label="Peak hour today"
        value={
          peak?.peakHour != null
            ? `${String(peak.peakHour).padStart(2, "0")}:00`
            : "—"
        }
        hint={
          peak?.peakStudents != null
            ? `~${formatNumber(peak.peakStudents)} on campus`
            : "not enough history yet"
        }
      />
    </>
  );
}
