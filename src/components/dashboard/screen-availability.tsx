"use client";

import { useEffect } from "react";
import { ALWAYS_ON, useDisplayStore } from "@/stores/display-store";
import type { DisplayScreenId } from "@/types/campus";

/**
 * Tells the rotation which screens currently have something to show.
 *
 * Rendered by the (server) board, so the decision is made from server data and
 * this component only carries it across the client boundary — it renders
 * nothing itself.
 */
export function ScreenAvailability({ hasSlides }: { hasSlides: boolean }) {
  const setAvailableScreens = useDisplayStore((s) => s.setAvailableScreens);

  useEffect(() => {
    const screens: DisplayScreenId[] = hasSlides
      ? [...ALWAYS_ON, "slides"]
      : [...ALWAYS_ON];
    setAvailableScreens(screens);
  }, [hasSlides, setAvailableScreens]);

  return null;
}
