"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DisplayScreenId } from "@/types/campus";

export const DISPLAY_SCREENS: { id: DisplayScreenId; label: string }[] = [
  { id: "presence", label: "On Campus" },
  { id: "achievements", label: "Achievements" },
  { id: "coalitions", label: "Coalitions" },
];

type DisplayState = {
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  activeScreen: DisplayScreenId;
  setRotationEnabled: (value: boolean) => void;
  setActiveScreen: (screen: DisplayScreenId) => void;
  nextScreen: () => void;
  prevScreen: () => void;
};

function cycle(current: DisplayScreenId, delta: number): DisplayScreenId {
  const list = DISPLAY_SCREENS.map((s) => s.id);
  const index = Math.max(0, list.indexOf(current));
  const next = (index + delta + list.length) % list.length;
  return list[next] ?? "presence";
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set, get) => ({
      rotationEnabled: true,
      rotationIntervalMs: 20_000,
      activeScreen: "presence",
      setRotationEnabled: (rotationEnabled) => set({ rotationEnabled }),
      setActiveScreen: (activeScreen) => set({ activeScreen }),
      nextScreen: () => set({ activeScreen: cycle(get().activeScreen, 1) }),
      prevScreen: () => set({ activeScreen: cycle(get().activeScreen, -1) }),
    }),
    { name: "ft-warsaw-display" },
  ),
);
