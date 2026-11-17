"use client";

import * as React from "react";

/** A whole number between min and max (both included). */
export function randomBetween(min: number, max: number, random: () => number = Math.random): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(random() * (hi - lo + 1));
}

/**
 * «يشاهدون هذا المنتج الآن» as the merchant set it: a number picked at random between `min` and
 * `max`, picked again every `every` seconds. Null while the server draws the page (no mismatch)
 * and when it's off.
 */
export function useViewers({ enabled, min, max, every }: { enabled: boolean; min: number; max: number; every: number }): number | null {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    const pick = () => setCount(randomBetween(min, max));
    // First number right after the page shows (a timer, so it isn't set during render).
    const first = window.setTimeout(pick, 0);
    const timer = window.setInterval(pick, Math.max(3, every) * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [enabled, min, max, every]);
  return enabled ? count : null;
}
