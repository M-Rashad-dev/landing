import type { TeknoInstallments } from "./types";

/**
 * The approximate monthly amount in whole pounds (docs/plans/tekno/PLAN.md §4.5): ceil(price × (1 + interest / 100)
 * / months), worked in integer piastres and rounded up (never shows less than the provider asks). Display only:
 * nothing of it goes to the checkout.
 */
export function monthlyAmount(price: number, months: number, interestPercent: number): number {
  const piastres = Math.round(price * 100);
  // piastres × (100 + i) is the total in hundredths of piastres; a month is that over months, back to pounds.
  return Math.ceil((piastres * (100 + Math.round(interestPercent))) / (months * 100 * 100));
}

/** The line a price shows («أو X ج/شهر»), or null when installments are off or the price is under the minimum. */
export function installmentOf(price: number, plan: TeknoInstallments, months = plan.card_months): { months: number; amount: number } | null {
  if (!plan.enabled || price <= 0 || price < plan.min_price || months <= 0) return null;
  return { months, amount: monthlyAmount(price, months, plan.interest_percent) };
}
