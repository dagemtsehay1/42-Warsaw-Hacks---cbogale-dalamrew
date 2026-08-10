import { beforeEach, describe, expect, it } from "vitest";
import { ALWAYS_ON, useDisplayStore } from "@/stores/display-store";

describe("display store", () => {
  beforeEach(() => {
    useDisplayStore.setState({
      rotationEnabled: true,
      rotationIntervalMs: 20_000,
      activeScreen: "stats",
      availableScreens: ALWAYS_ON,
    });
  });

  it("cycles screens forward and wraps around", () => {
    const order = [...ALWAYS_ON.slice(1), ALWAYS_ON[0]];
    for (const expected of order) {
      useDisplayStore.getState().nextScreen();
      expect(useDisplayStore.getState().activeScreen).toBe(expected);
    }
  });

  it("cycles screens backward and wraps around", () => {
    const order = [...ALWAYS_ON].reverse().slice(0, -1).concat(ALWAYS_ON[0]);
    for (const expected of order) {
      useDisplayStore.getState().prevScreen();
      expect(useDisplayStore.getState().activeScreen).toBe(expected);
    }
  });

  it("returns to the same screen after next then prev", () => {
    useDisplayStore.getState().nextScreen();
    useDisplayStore.getState().prevScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("stats");
  });

  it("toggles rotation on and off", () => {
    useDisplayStore.getState().setRotationEnabled(false);
    expect(useDisplayStore.getState().rotationEnabled).toBe(false);
  });

  describe("availability", () => {
    it("skips screens that have nothing to show", () => {
      // The default rotation excludes `slides`, so it must never be reached.
      const seen = new Set<string>();
      for (let i = 0; i < ALWAYS_ON.length * 2; i += 1) {
        useDisplayStore.getState().nextScreen();
        seen.add(useDisplayStore.getState().activeScreen);
      }
      expect(seen.has("slides")).toBe(false);
      expect(seen.size).toBe(ALWAYS_ON.length);
    });

    it("includes slides once bocal has uploaded one", () => {
      useDisplayStore.getState().setAvailableScreens([...ALWAYS_ON, "slides"]);

      const seen = new Set<string>();
      for (let i = 0; i < ALWAYS_ON.length + 1; i += 1) {
        useDisplayStore.getState().nextScreen();
        seen.add(useDisplayStore.getState().activeScreen);
      }
      expect(seen.has("slides")).toBe(true);
    });

    it("moves off a screen whose content just disappeared", () => {
      useDisplayStore.getState().setAvailableScreens([...ALWAYS_ON, "slides"]);
      useDisplayStore.getState().setActiveScreen("slides");

      // Last slide deleted.
      useDisplayStore.getState().setAvailableScreens([...ALWAYS_ON]);
      expect(useDisplayStore.getState().activeScreen).not.toBe("slides");
      expect(ALWAYS_ON).toContain(useDisplayStore.getState().activeScreen);
    });

    it("keeps cycling rather than sticking when the active screen is gone", () => {
      useDisplayStore.setState({
        availableScreens: [...ALWAYS_ON],
        activeScreen: "slides",
      });
      useDisplayStore.getState().nextScreen();
      expect(ALWAYS_ON).toContain(useDisplayStore.getState().activeScreen);
    });
  });
});
