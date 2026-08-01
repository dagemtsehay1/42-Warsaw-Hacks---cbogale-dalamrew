"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

function getFullscreenSnapshot() {
  return Boolean(document.fullscreenElement);
}

function getFullscreenServerSnapshot() {
  return false;
}

export function FullscreenToggle({
  targetRef,
}: {
  targetRef?: React.RefObject<HTMLElement | null>;
}) {
  const active = useSyncExternalStore(
    subscribeFullscreen,
    getFullscreenSnapshot,
    getFullscreenServerSnapshot,
  );
  const [supported] = useState(() =>
    typeof document !== "undefined" ? Boolean(document.fullscreenEnabled) : true,
  );

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const el = targetRef?.current ?? document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        window.location.href = "/dashboard/display";
      }
    } catch {
      window.location.href = "/dashboard/display";
    }
  }, [targetRef]);

  if (!supported) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          window.location.href = "/dashboard/display";
        }}
      >
        Display mode
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      <span className="hidden sm:inline">{active ? "Exit" : "Fullscreen"}</span>
    </Button>
  );
}
