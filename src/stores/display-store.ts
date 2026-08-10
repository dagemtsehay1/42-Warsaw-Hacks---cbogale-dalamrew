"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DisplayScreenId } from "@/types/campus";

export const DISPLAY_SCREENS: { id: DisplayScreenId; label: string }[] = [
  { id: "stats", label: "Campus Stats" },
  { id: "presence", label: "On Campus" },
  { id: "achievements", label: "Achievements" },
  { id: "coalitions", label: "Coalitions" },
  { id: "events", label: "This Week" },
  { id: "slides", label: "Notices" },
];

/**
 * Screens that are always in the rotation. `slides` is not one of them: with no
 * uploads it would be twenty seconds of blank wall every cycle, so the board
 * switches it on only when bocal has something to show.
 */
const ALWAYS_ON: DisplayScreenId[] = [
  "stats",
  "presence",
  "achievements",
  "coalitions",
  "events",
];

type DisplayState = {
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  activeScreen: DisplayScreenId;
  /** Which screens have content right now; set by the board each render. */
  availableScreens: DisplayScreenId[];
  setRotationEnabled: (value: boolean) => void;
  setActiveScreen: (screen: DisplayScreenId) => void;
  setAvailableScreens: (screens: DisplayScreenId[]) => void;
  nextScreen: () => void;
  prevScreen: () => void;
};

function cycle(
  current: DisplayScreenId,
  delta: number,
  available: DisplayScreenId[],
): DisplayScreenId {
  // Keep DISPLAY_SCREENS' order regardless of what order availability arrives in.
  const list = DISPLAY_SCREENS.map((s) => s.id).filter((id) =>
    available.includes(id),
  );
  if (list.length === 0) return "stats";

  const index = list.indexOf(current);
  // A screen that just lost its content isn't in the list; step from the start
  // rather than wrapping off a -1.
  const from = index < 0 ? 0 : index;
  const next = (from + delta + list.length) % list.length;
  return list[next] ?? "stats";
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set, get) => ({
      rotationEnabled: true,
      rotationIntervalMs: 20_000,
      activeScreen: "stats",
      availableScreens: ALWAYS_ON,
      setRotationEnabled: (rotationEnabled) => set({ rotationEnabled }),
      setActiveScreen: (activeScreen) => set({ activeScreen }),
      setAvailableScreens: (availableScreens) =>
        set((state) => ({
          availableScreens,
          // If the screen on display just went away (last slide deleted), move
          // on instead of rendering nothing until the next tick.
          activeScreen: availableScreens.includes(state.activeScreen)
            ? state.activeScreen
            : (availableScreens[0] ?? "stats"),
        })),
      nextScreen: () =>
        set({
          activeScreen: cycle(get().activeScreen, 1, get().availableScreens),
        }),
      prevScreen: () =>
        set({
          activeScreen: cycle(get().activeScreen, -1, get().availableScreens),
        }),
    }),
    {
      name: "ft-warsaw-display",
      version: 2,
      // Availability is a property of the current data, not of this browser —
      // persisting it would resurrect a stale screen list after a TV reboot.
      partialize: (state) => ({
        rotationEnabled: state.rotationEnabled,
        rotationIntervalMs: state.rotationIntervalMs,
        activeScreen: state.activeScreen,
      }),
    },
  ),
);

export { ALWAYS_ON };
