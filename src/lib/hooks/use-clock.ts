"use client";

import { useSyncExternalStore } from "react";

function createClock(intervalMs: number) {
  let snapshot = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        snapshot = Date.now();
        timer = setInterval(() => {
          snapshot = Date.now();
          for (const notify of listeners) notify();
        }, intervalMs);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    // React may read this several times in one render. Only the timer (or a
    // fresh subscription) changes it; reading Date.now() here causes a loop.
    getSnapshot: () => snapshot,
    getServerSnapshot: () => 0,
  };
}

const clocks = {
  1000: createClock(1000),
  30000: createClock(30000),
  60000: createClock(60000),
};

/** Current milliseconds at the requested cadence; 0 during SSR/hydration. */
export function useClock(intervalMs: keyof typeof clocks): number {
  const clock = clocks[intervalMs];
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
}
