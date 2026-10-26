/** Latin digits (0-9) everywhere, with thousands separators. */
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return "0";
  return integerFormatter.format(n);
}
