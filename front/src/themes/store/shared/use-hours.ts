"use client";

import * as React from "react";

/** A day's hours: open or not, "HH:MM" to "HH:MM" (a "to" before "from" ends after midnight). */
export type DayHours = { open: boolean; from: string; to: string };

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Open at this moment? `days` is Saturday first (the Egyptian week); `day` is the index of today
 * in it and `now` the minutes since midnight. Hours past midnight count for the day they started.
 */
export function isOpenAt(days: DayHours[], day: number, now: number): boolean {
  const today = days[day];
  if (today?.open) {
    const from = minutes(today.from);
    const to = minutes(today.to);
    if (from === to) return true; // all day
    if (from < to ? now >= from && now < to : now >= from) return true;
  }
  const yesterday = days[(day + 6) % 7];
  if (yesterday?.open) {
    const from = minutes(yesterday.from);
    const to = minutes(yesterday.to);
    if (to < from && now < to) return true;
  }
  return false;
}

/** Today in Cairo: the index in a Saturday-first week and the minutes since midnight. */
export function cairoNow(at: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const order = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return { day: Math.max(0, order.indexOf(get("weekday"))), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const everyMinute = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 30000);
  return () => window.clearInterval(timer);
};

/**
 * Whether the store is open now by Cairo time, and today's index (Saturday = 0). Null while the
 * server draws the page (it can't know the visitor's moment): the page shows no status then.
 */
export function useOpenNow(days: DayHours[]): { open: boolean; today: number } | null {
  const key = React.useSyncExternalStore(
    everyMinute,
    () => {
      const now = cairoNow();
      return `${now.day}:${now.minutes}`;
    },
    () => null,
  );
  if (key === null) return null;
  const [day, mins] = key.split(":").map(Number);
  return { open: isOpenAt(days, day, mins), today: day };
}
