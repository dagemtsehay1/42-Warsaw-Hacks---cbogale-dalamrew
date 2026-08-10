import { describe, expect, it } from "vitest";
import {
  CAMPUS_DAY_START_HOUR,
  campusDayStart,
} from "@/features/campus/campus-time";

/** Builds a campus-local time on a fixed date, free of the runner's timezone. */
function localTime(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 7, day, hour, minute, 0, 0);
}

describe("campusDayStart", () => {
  it("returns 05:00 today once the day has started", () => {
    const start = campusDayStart(localTime(12, 9, 30));
    expect(start.getDate()).toBe(12);
    expect(start.getHours()).toBe(CAMPUS_DAY_START_HOUR);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("keeps the small hours in the previous day", () => {
    // 02:00 is somebody finishing yesterday, not starting today.
    const start = campusDayStart(localTime(12, 2));
    expect(start.getDate()).toBe(11);
    expect(start.getHours()).toBe(CAMPUS_DAY_START_HOUR);
  });

  it("rolls over exactly at 05:00", () => {
    expect(campusDayStart(localTime(12, 4, 59)).getDate()).toBe(11);
    expect(campusDayStart(localTime(12, 5, 0)).getDate()).toBe(12);
  });

  it("is never in the future", () => {
    for (const hour of [0, 4, 5, 6, 13, 23]) {
      const now = localTime(12, hour);
      expect(campusDayStart(now).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it("does not mutate the date it is given", () => {
    const now = localTime(12, 2);
    const before = now.getTime();
    campusDayStart(now);
    expect(now.getTime()).toBe(before);
  });
});
