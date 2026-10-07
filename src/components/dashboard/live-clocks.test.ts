// @vitest-environment jsdom
import { createElement, Fragment, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardClock } from "./dashboard-clock";
import { LastUpdated } from "./last-updated";
import { HallOfFame } from "./hall-of-fame";

const initialTime = new Date("2026-10-07T10:00:00Z").getTime();
const session = {
  login: "student", displayName: "Student", host: "c1r1p1",
  beginAt: "2026-10-07T09:00:00Z", endAt: null, durationMs: 3_600_000,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(initialTime);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("dashboard live clocks", () => {
  it("keeps rendering when time advances between React snapshot reads", () => {
    // A frozen fake Date.now() hides the render loop. Simulate real elapsed
    // milliseconds between reads to reproduce the failure deterministically.
    let reads = 0;
    vi.spyOn(Date, "now").mockImplementation(() => initialTime + reads++);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = createElement(Fragment, null,
      createElement(LastUpdated, { fetchedAt: "2026-10-07T09:20:00Z" }),
      createElement(HallOfFame, { session, weekStart: "2026-10-05T03:00:00Z" }),
      createElement(DashboardClock),
    );
    expect(() => render(createElement(StrictMode, null, view))).not.toThrow();
    for (let minute = 0; minute < 10; minute++) {
      act(() => vi.advanceTimersByTime(60_000));
    }
    expect(screen.getByText("Hall of Fame")).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  });

  it("updates stale data age and running sessions across minutes, and cleans up timers", () => {
    const view = render(createElement(Fragment, null,
      createElement(LastUpdated, { fetchedAt: "2026-10-07T09:20:00Z" }),
      createElement(HallOfFame, { session, weekStart: "2026-10-05T03:00:00Z" }),
      createElement(DashboardClock),
    ));
    expect(screen.getByText("(40 min ago)")).toBeTruthy();
    expect(screen.getByText("1h 0m")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(screen.getByText("(45 min ago)")).toBeTruthy();
    expect(screen.getByText("1h 5m")).toBeTruthy();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves completed sessions unchanged", () => {
    render(createElement(HallOfFame, {
      session: { ...session, endAt: "2026-10-07T10:00:00Z" }, weekStart: "2026-10-05T03:00:00Z",
    }));
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(screen.getByText("1h 0m")).toBeTruthy();
  });

  it("renders deterministic clock placeholders on the server", () => {
    expect(renderToString(createElement(DashboardClock))).toContain("--:--");
    expect(renderToString(createElement(HallOfFame, {
      session, weekStart: "2026-10-05T03:00:00Z",
    }))).toContain("1h 0m");
  });
});
