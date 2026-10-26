import { ar } from "@/messages/ar";

const wholeFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** 1250 → "1,250 ج.م", 99.5 → "99.50 ج.م". Display only; the back end is the price authority. */
export function formatPrice(value: number | string | null | undefined, { withCurrency = true } = {}): string {
  const n = toNumber(value);
  const cents = Math.round(n * 100);
  const text = cents % 100 === 0 ? wholeFormatter.format(cents / 100) : decimalFormatter.format(cents / 100);
  return withCurrency ? `${text} ${ar.common.currency}` : text;
}

/** Whole-percent discount between the old and the current price, or null when there is none. */
export function discountPercent(price: number | string | null | undefined, compareAt: number | string | null | undefined): number | null {
  const current = toNumber(price);
  const old = toNumber(compareAt);
  if (old <= 0 || current <= 0 || old <= current) return null;
  return Math.round(((old - current) / old) * 100);
}

/** Integer cents, rounding half up on the decimal text (no float drift, matches the back end). */
export function toCents(value: number | string | null | undefined): number {
  const n = toNumber(value);
  const negative = n < 0;
  const text = Math.abs(n).toFixed(10);
  const [whole, fraction = ""] = text.split(".");
  const padded = `${fraction}000`;
  let cents = Number(whole) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1;
  return negative ? -cents : cents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}
