"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DISPLAY_SCREENS, useDisplayStore } from "@/stores/display-store";
import { cn } from "@/lib/utils/cn";

export function ScreenRotation() {
  const {
    rotationEnabled,
    rotationIntervalMs,
    activeScreen,
    availableScreens,
    nextScreen,
    prevScreen,
  } = useDisplayStore();

  // `activeScreen` is a dependency so a manual jump restarts the countdown —
  // without it, clicking next late in a cycle auto-advances again moments later.
  useEffect(() => {
    if (!rotationEnabled) return;
    const id = window.setInterval(() => nextScreen(), rotationIntervalMs);
    return () => window.clearInterval(id);
  }, [rotationEnabled, rotationIntervalMs, nextScreen, activeScreen]);

  const activeLabel = DISPLAY_SCREENS.find((s) => s.id === activeScreen)?.label;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        className="h-12 w-12 shrink-0"
        onClick={prevScreen}
        aria-label="Previous screen"
      >
        <ChevronLeft className="h-7 w-7" />
      </Button>

      {/* Naming the screen makes the arrows self-explanatory from across the room. */}
      <div className="flex min-w-[9rem] flex-col items-center gap-1.5">
        <span className="text-sm uppercase tracking-[0.14em] text-[var(--foreground)]">
          {activeLabel}
        </span>
        {/* One dot per screen actually in the rotation, so the count matches
            what the arrows step through. */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {DISPLAY_SCREENS.filter((s) => availableScreens.includes(s.id)).map((screen) => (
            <span
              key={screen.id}
              className={cn(
                "h-2 w-2 rounded-full border border-[var(--border)] transition-colors",
                activeScreen === screen.id
                  ? "bg-[var(--accent)] border-[var(--accent)]"
                  : "bg-transparent",
              )}
            />
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-12 w-12 shrink-0"
        onClick={nextScreen}
        aria-label="Next screen"
      >
        <ChevronRight className="h-7 w-7" />
      </Button>
    </div>
  );
}
