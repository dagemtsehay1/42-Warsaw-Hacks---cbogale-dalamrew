import { describe, expect, it } from "vitest";
import { formatRelativeTime, formatLevel } from "@/lib/utils/format";

describe("format helpers", () => {
  it("formats levels", () => {
    expect(formatLevel(8.424)).toBe("8.42");
    expect(formatLevel(undefined)).toBe("—");
  });

  it("formats relative time", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    expect(formatRelativeTime("2026-07-27T11:50:00.000Z", now)).toBe("10 min ago");
  });
});
