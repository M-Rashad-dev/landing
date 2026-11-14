import { ar } from "@/messages/ar";
import type { ProductOffer } from "./types";

const t = ar.storefront.offers;

/** The offers a customer can get now (scheduled ones wait for their start). */
export function activeOffers(offers: ProductOffer[], now = Date.now()): ProductOffer[] {
  return offers.filter((offer) => {
    if (offer.status !== "active") return false;
    if (offer.ends_at && new Date(offer.ends_at).getTime() < now) return false;
    if (offer.starts_at && new Date(offer.starts_at).getTime() > now) return false;
    return true;
  });
}

/** One line that says what the offer gives (the merchant's badge text wins when set). */
export function offerLabel(offer: ProductOffer): string {
  if (offer.badge_text) return offer.badge_text;
  const min = Math.max(1, offer.min_quantity ?? 1);
  switch (offer.type) {
    case "percentage":
      return t.percentage(offer.value ?? 0, min);
    case "fixed":
      return t.fixed(offer.value ?? 0, min);
    case "bundle":
      return t.bundle(offer.bundle_quantity ?? 2, offer.bundle_price ?? 0);
    case "buy_get":
      return t.buyGet(min, offer.free_quantity ?? 1);
    case "gift":
      return t.gift(offer.gift?.name ?? "", min);
  }
}

/** Quantity to order to get the offer. */
export function offerQuantity(offer: ProductOffer): number {
  return Math.max(1, offer.required_quantity || 1);
}

/** Price of one unit after an offer that needs no quantity (for the headline price), or null. */
export function unitPriceAfter(offers: ProductOffer[], price: number): number | null {
  let best: number | null = null;
  for (const offer of activeOffers(offers)) {
    if ((offer.min_quantity ?? 1) > 1) continue;
    let after: number | null = null;
    if (offer.type === "percentage") after = price - Math.round(price * (offer.value ?? 0)) / 100;
    if (offer.type === "fixed") after = Math.max(0, price - (offer.value ?? 0));
    if (after !== null && after < price && (best === null || after < best)) best = Math.round(after * 100) / 100;
  }
  return best;
}
