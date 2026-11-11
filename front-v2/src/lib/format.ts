/**
 * Number, money, date and phone display for the dashboard.
 * Digits stay Latin (0-9) everywhere so tables line up and phones / order numbers read the same as typed.
 */

const NUMBER = new Intl.NumberFormat("en-US");
const MONEY = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const CURRENCY = "ج.م";

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : NUMBER.format(value);
}

/** 1250.5 → "1,250.5 ج.م" */
export function formatMoney(value: number | string | null | undefined, { withCurrency = true } = {}): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const text = MONEY.format(n);
  return withCurrency ? `${text} ${CURRENCY}` : text;
}

/** 12.3456 → "12.35%" ; signed adds "+" for growth. */
export function formatPercent(value: number | null | undefined, { signed = false } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const text = `${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  if (!signed || value === 0) return text;
  return value > 0 ? `+${text}` : `−${text}`;
}

const CAIRO = "Africa/Cairo";

/** "11/11/2026 15:29" in Cairo time (dashboard tables). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CAIRO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** "11 نوفمبر" for chart axes. */
export function formatDayShort(isoDate: string): string {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", timeZone: "UTC", numberingSystem: "latn" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** +201012345678 → "01012345678" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  return e164.startsWith("+20") ? `0${e164.slice(3)}` : e164;
}
