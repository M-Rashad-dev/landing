import { timeLeft, type TimeLeft } from "@/themes/store/shared/use-countdown";
import type { DealOfDayProps } from "./types";

const DAY = 86400;

/** Seconds from `now` to the next midnight in Cairo (the store's day, whatever the visitor's clock zone). */
export function secondsToCairoMidnight(now: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return DAY - (get("hour") * 3600 + get("minute") * 60 + get("second"));
}

/** What is left of «عرض اليوم»: to Cairo midnight (never ends: a new day starts), or to its date (null before the browser knows the time). */
export function dealTimeLeft(props: Pick<DealOfDayProps, "ends" | "ends_at">, now: number | null): TimeLeft | null {
  if (now === null) return null;
  if (props.ends === "date") return props.ends_at ? timeLeft(props.ends_at, now) : null;
  const left = secondsToCairoMidnight(now);
  return { days: 0, hours: Math.floor(left / 3600), minutes: Math.floor(left / 60) % 60, seconds: left % 60, ended: false };
}

/** «اتباع X% من الكمية · فاضل N قطعة بس»: only for a product that counts its stock and has sold some since the start. */
export function dealStock(start: number | null, stock: number | null | undefined): { percent: number; left: number } | null {
  if (start === null || stock === null || stock === undefined || stock <= 0 || start <= stock) return null;
  return { percent: Math.round(((start - stock) * 100) / start), left: stock };
}
