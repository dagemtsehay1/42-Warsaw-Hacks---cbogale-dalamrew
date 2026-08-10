import { describe, expect, it } from "vitest";
import { eventWeek, toCampusEvent } from "@/features/campus/events";
import { weekStart } from "@/features/campus/sessions";
import type { FortyTwoEvent } from "@/lib/api/42/types";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function event(overrides: Partial<FortyTwoEvent> = {}): FortyTwoEvent {
  return {
    id: 1,
    name: "Intro to Docker",
    begin_at: "2026-08-06T17:00:00.000Z",
    ...overrides,
  };
}

describe("eventWeek", () => {
  it("runs Monday 05:00 to the next Monday 05:00", () => {
    const { from, to } = eventWeek(NOW);

    expect(from.toISOString()).toBe(weekStart(NOW).toISOString());
    expect(from.getDay()).toBe(1);
    expect(from.getHours()).toBe(5);
    expect(to.getDay()).toBe(1);
    expect(to.getHours()).toBe(5);
    expect(to.getTime() - from.getTime()).toBe(7 * 864e5);
  });

  it("contains the moment it was asked about", () => {
    const { from, to } = eventWeek(NOW);
    expect(from.getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(to.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe("toCampusEvent", () => {
  it("maps the fields the screen uses", () => {
    const mapped = toCampusEvent(
      event({
        description: "Bring a laptop",
        kind: "workshop",
        location: "Cluster 1",
        end_at: "2026-08-06T19:00:00.000Z",
        max_people: 30,
        nbr_subscribers: 12,
      }),
    );

    expect(mapped).toEqual({
      id: 1,
      name: "Intro to Docker",
      description: "Bring a laptop",
      kind: "workshop",
      location: "Cluster 1",
      beginAt: "2026-08-06T17:00:00.000Z",
      endAt: "2026-08-06T19:00:00.000Z",
      maxPeople: 30,
      subscribers: 12,
    });
  });

  it("nulls the optional fields rather than dropping the event", () => {
    // The live response shape is unverified, so a sparse event must still show.
    const mapped = toCampusEvent(event());
    expect(mapped).not.toBeNull();
    expect(mapped?.location).toBeNull();
    expect(mapped?.kind).toBeNull();
    expect(mapped?.subscribers).toBeNull();
  });

  it("drops rows missing the three fields the screen cannot do without", () => {
    expect(toCampusEvent(event({ id: 0 }))).toBeNull();
    expect(toCampusEvent(event({ name: "" }))).toBeNull();
    expect(toCampusEvent(event({ begin_at: "" }))).toBeNull();
    expect(toCampusEvent(event({ begin_at: "not a date" }))).toBeNull();
  });
});
