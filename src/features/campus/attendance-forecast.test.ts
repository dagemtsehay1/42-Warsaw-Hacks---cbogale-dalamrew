import { describe, expect, it } from "vitest";
import {
  addDays,
  buildOutlook,
  forecastAttendance,
  trendFactor,
  weekdayOf,
  type DailyAttendance,
  type HourlyLoad,
} from "@/features/campus/attendance-forecast";

// 2026-08-03 is a Monday.
const TODAY = "2026-08-03";

/** `weeks` weeks of history where every weekday has a fixed attendance. */
function history(
  perWeekday: Record<number, number>,
  weeks = 8,
  until = TODAY,
): DailyAttendance[] {
  const days: DailyAttendance[] = [];
  for (let back = 1; back <= weeks * 7; back += 1) {
    const date = addDays(until, -back);
    days.push({ date, students: perWeekday[weekdayOf(date)] ?? 0 });
  }
  return days;
}

describe("date helpers", () => {
  it("reads weekdays independently of the server timezone", () => {
    expect(weekdayOf("2026-08-03")).toBe(1);
    expect(weekdayOf("2026-08-02")).toBe(0);
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("forecastAttendance", () => {
  const weekdayShape = { 0: 12, 1: 60, 2: 64, 3: 58, 4: 55, 5: 40, 6: 18 };

  it("forecasts a weekday from that weekday's own history", () => {
    const tuesday = addDays(TODAY, 1);
    const forecast = forecastAttendance(
      history(weekdayShape),
      [],
      tuesday,
      TODAY,
    );

    expect(forecast?.expected).toBe(64);
    expect(forecast?.sampleDays).toBe(8);
  });

  it("does not let a holiday outlier drag the estimate", () => {
    const days = history(weekdayShape);
    // Last Tuesday the campus was shut.
    const lastTuesday = days.find((d) => weekdayOf(d.date) === 2);
    if (lastTuesday) lastTuesday.students = 0;

    const forecast = forecastAttendance(days, [], addDays(TODAY, 1), TODAY);
    expect(forecast?.expected).toBe(64);
    expect(forecast?.low).toBeLessThanOrEqual(64);
  });

  it("follows a sustained change instead of averaging it away", () => {
    const days = history(weekdayShape);
    // The last three Tuesdays were empty — a summer shutdown, not a one-off.
    for (const day of days.filter((d) => weekdayOf(d.date) === 2).slice(0, 3)) {
      day.students = 0;
    }

    // Those three carry 59% of the weight, so the median moves with them: one
    // holiday is noise, three in a row is the new normal.
    const forecast = forecastAttendance(days, [], addDays(TODAY, 1), TODAY);
    expect(forecast?.expected).toBe(0);
    expect(forecast?.high).toBe(64);
  });

  it("keeps weekends and weekdays apart", () => {
    const days = history(weekdayShape);
    const sunday = forecastAttendance(days, [], "2026-08-09", TODAY);
    const tuesday = forecastAttendance(days, [], "2026-08-04", TODAY);

    expect(sunday?.expected).toBe(12);
    expect(tuesday?.expected).toBe(64);
  });

  it("ignores days at or after `today`, so re-running cannot move it", () => {
    const days = history(weekdayShape);
    days.push({ date: TODAY, students: 3 }, { date: addDays(TODAY, 1), students: 999 });

    const forecast = forecastAttendance(days, [], addDays(TODAY, 1), TODAY);
    expect(forecast?.expected).toBe(64);
  });

  it("follows a campus-wide trend within the clamp", () => {
    const days = history(weekdayShape);
    // Everything in the last fortnight is 30% quieter than before it.
    for (const day of days) {
      if (Number(day.date.replaceAll("-", "")) >= 20260720) {
        day.students = Math.round(day.students * 0.7);
      }
    }

    const factor = trendFactor(days, TODAY);
    expect(factor).toBeGreaterThan(0.84);
    expect(factor).toBeLessThan(0.87); // clamped at -15%

    const forecast = forecastAttendance(days, [], addDays(TODAY, 1), TODAY);
    // Tuesday's own median already fell to 45; the clamp stops a double count.
    expect(forecast?.expected).toBeLessThan(64);
    expect(forecast?.expected).toBeGreaterThan(30);
  });

  it("returns null when that weekday has never been seen", () => {
    expect(forecastAttendance([], [], addDays(TODAY, 1), TODAY)).toBeNull();
  });

  it("picks the busiest hour from the same weekday's profile", () => {
    const days = history(weekdayShape);
    const tuesdays = days.filter((d) => weekdayOf(d.date) === 2);
    const hourly: HourlyLoad[] = tuesdays.flatMap((day) => [
      { date: day.date, hour: 10, students: 20 },
      { date: day.date, hour: 15, students: 46 },
      { date: day.date, hour: 20, students: 31 },
    ]);

    const forecast = forecastAttendance(days, hourly, addDays(TODAY, 1), TODAY);
    expect(forecast?.peakHour).toBe(15);
    expect(forecast?.peakStudents).toBe(46);
  });
});

describe("buildOutlook", () => {
  it("covers today plus the next three days", () => {
    const outlook = buildOutlook(
      history({ 0: 12, 1: 60, 2: 64, 3: 58, 4: 55, 5: 40, 6: 18 }),
      [],
      TODAY,
    );

    expect(outlook.map((f) => f.targetDate)).toEqual([
      TODAY,
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
    ]);
  });
});
