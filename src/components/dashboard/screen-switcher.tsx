"use client";

import type { ReactNode } from "react";
import { useDisplayStore } from "@/stores/display-store";
import type { DisplayScreenId } from "@/types/campus";

/**
 * The one piece of the board that has to run in the browser: it picks which of
 * the four **server-rendered** screens to show. The screens arrive as rendered
 * children, so switching costs no data fetching, no charting library and no
 * re-render of anything but this wrapper.
 */
export function ScreenSwitcher({
  screens,
}: {
  screens: Record<DisplayScreenId, ReactNode>;
}) {
  const activeScreen = useDisplayStore((s) => s.activeScreen);

  return (
    <div
      key={activeScreen}
      className="board-screen flex h-full min-h-0 flex-col gap-3"
    >
      {screens[activeScreen] ?? screens.stats}
    </div>
  );
}
