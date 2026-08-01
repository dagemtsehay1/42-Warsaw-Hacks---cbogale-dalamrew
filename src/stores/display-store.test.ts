import { beforeEach, describe, expect, it } from "vitest";
import { useDisplayStore } from "@/stores/display-store";

describe("display store", () => {
  beforeEach(() => {
    useDisplayStore.setState({
      rotationEnabled: true,
      rotationIntervalMs: 20_000,
      activeScreen: "presence",
    });
  });

  it("cycles screens forward and wraps around", () => {
    useDisplayStore.getState().nextScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("achievements");
    useDisplayStore.getState().nextScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("coalitions");
    useDisplayStore.getState().nextScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("presence");
  });

  it("cycles screens backward and wraps around", () => {
    useDisplayStore.getState().prevScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("coalitions");
    useDisplayStore.getState().prevScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("achievements");
    useDisplayStore.getState().prevScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("presence");
  });

  it("returns to the same screen after next then prev", () => {
    useDisplayStore.getState().nextScreen();
    useDisplayStore.getState().prevScreen();
    expect(useDisplayStore.getState().activeScreen).toBe("presence");
  });

  it("toggles rotation on and off", () => {
    useDisplayStore.getState().setRotationEnabled(false);
    expect(useDisplayStore.getState().rotationEnabled).toBe(false);
  });
});
