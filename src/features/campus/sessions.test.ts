import { startOfWeek } from "date-fns";
import { describe, expect, it } from "vitest";
import { pickTopSession, weekStart } from "@/features/campus/sessions";
import type { FortyTwoLocation } from "@/lib/api/42/types";

const NOW = new Date("2026-08-01T15:00:00.000Z");

let nextId = 1;
function location(
  login: string,
  beginAt: string,
  endAt: string | null,
): FortyTwoLocation {
  const id = nextId++;
  return {
    id,
    begin_at: beginAt,
    end_at: endAt,
    primary: true,
    host: `c1r1s${id}`,
    campus_id: 67,
    user: { id, login, first_name: "Test", last_name: "Student", image: {} },
  };
}

describe("weekStart", () => {
  it("starts the week on Sunday", () => {
    // Derived, not hardcoded: the boundary is campus-local, not UTC midnight.
    expect(weekStart(NOW).toISOString()).toBe(
      startOfWeek(NOW, { weekStartsOn: 0 }).toISOString(),
    );
    expect(weekStart(NOW).getDay()).toBe(0);
  });
});

describe("pickTopSession", () => {
  it("returns the longest closed session", () => {
    const top = pickTopSession(
      [
        location("short", "2026-07-27T08:00:00.000Z", "2026-07-27T12:00:00.000Z"),
        location("long", "2026-07-28T08:00:00.000Z", "2026-07-28T20:48:00.000Z"),
        location("mid", "2026-07-29T08:00:00.000Z", "2026-07-29T16:00:00.000Z"),
      ],
      NOW,
    );

    expect(top?.login).toBe("long");
    expect(top?.durationMs).toBe(12.8 * 3600_000);
    expect(top?.endAt).toBe("2026-07-28T20:48:00.000Z");
  });

  it("measures an open session up to now, so it can still win", () => {
    const top = pickTopSession(
      [
        location("closed", "2026-07-28T08:00:00.000Z", "2026-07-28T18:00:00.000Z"),
        location("stillhere", "2026-08-01T00:00:00.000Z", null),
      ],
      NOW,
    );

    expect(top?.login).toBe("stillhere");
    expect(top?.endAt).toBeNull();
    expect(top?.durationMs).toBe(15 * 3600_000);
  });

  it("breaks ties on the earlier start so the record does not flip", () => {
    const top = pickTopSession(
      [
        location("later", "2026-07-30T10:00:00.000Z", "2026-07-30T18:00:00.000Z"),
        location("earlier", "2026-07-29T10:00:00.000Z", "2026-07-29T18:00:00.000Z"),
      ],
      NOW,
    );

    expect(top?.login).toBe("earlier");
  });

  it("returns null when the window is empty", () => {
    expect(pickTopSession([], NOW)).toBeNull();
  });
});
