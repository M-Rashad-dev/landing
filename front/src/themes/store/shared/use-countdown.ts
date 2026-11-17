"use client";

import * as React from "react";

const tick = (live: boolean) => (onChange: () => void) => {
  if (!live) return () => {};
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
};

/** The time to the second in the browser (null while the server draws the page: no mismatch). */
export function useNow(live = true): number | null {
  const subscribe = React.useMemo(() => tick(live), [live]);
  return React.useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000) * 1000, () => null);
}

export type TimeLeft = { days: number; hours: number; minutes: number; seconds: number; ended: boolean };

/** What is left until `endsAt` (null before the browser knows the time). */
export function timeLeft(endsAt: string, now: number | null): TimeLeft | null {
  if (now === null) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    days: Math.floor(left / 86400000),
    hours: Math.floor(left / 3600000) % 24,
    minutes: Math.floor(left / 60000) % 60,
    seconds: Math.floor(left / 1000) % 60,
    ended: left === 0,
  };
}

export const pad = (n: number) => String(n).padStart(2, "0");
