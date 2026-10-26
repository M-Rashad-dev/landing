import { TZDate } from "@date-fns/tz";

/** Everything is stored in UTC and shown in Cairo time (Egypt observes DST). */
export const CAIRO = "Africa/Cairo";

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC ISO → value for <input type="datetime-local"> in Cairo time ("2026-11-01T10:00"). */
export function toCairoInputValue(utcIso: string | null | undefined): string {
  if (!utcIso) return "";
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "";
  const cairo = new TZDate(date.getTime(), CAIRO);
  return `${cairo.getFullYear()}-${pad(cairo.getMonth() + 1)}-${pad(cairo.getDate())}T${pad(cairo.getHours())}:${pad(cairo.getMinutes())}`;
}

/** datetime-local value (Cairo wall time) → UTC ISO string ("2026-11-01T08:00:00.000Z"), or null when empty/invalid. */
export function fromCairoInputValue(local: string | null | undefined): string | null {
  if (!local) return null;
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, y, m, d, h, min, s] = match;
  const cairo = new TZDate(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s ?? 0), CAIRO);
  return new Date(cairo.getTime()).toISOString();
}

/** "10/11/2026 14:05" in Cairo time with latin digits. */
export function formatCairo(utcIso: string | null | undefined, { withTime = true } = {}): string {
  if (!utcIso) return "";
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "";
  const c = new TZDate(date.getTime(), CAIRO);
  const day = `${pad(c.getDate())}/${pad(c.getMonth() + 1)}/${c.getFullYear()}`;
  return withTime ? `${day} ${pad(c.getHours())}:${pad(c.getMinutes())}` : day;
}

/** YYYY-MM-DD of "now" in Cairo (for date filters). */
export function cairoToday(): string {
  const c = new TZDate(Date.now(), CAIRO);
  return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
}
