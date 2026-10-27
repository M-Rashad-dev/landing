import type { PublicOffer, PublicProduct } from "@/themes/types";
import { fromCents, toCents } from "./index";

/**
 * Display-only offer math for themes (the back end is the price authority).
 * All amounts are computed in cents.
 */
export function activeOffers(offers: PublicOffer[], now = Date.now()): PublicOffer[] {
  return offers.filter((offer) => {
    if (offer.status !== "active") return false;
    if (offer.ends_at && new Date(offer.ends_at).getTime() < now) return false;
    if (offer.starts_at && new Date(offer.starts_at).getTime() > now) return false;
    return true;
  });
}

/** Total after the offer for `quantity` units at the base price (no option deltas). */
export function offerTotalCents(offer: PublicOffer, price: number, quantity: number): number | null {
  const unit = toCents(price);
  const base = unit * quantity;
  switch (offer.type) {
    case "percentage": {
      const pct = Math.round((offer.value ?? 0) * 100);
      return base - Math.floor((base * pct + 5000) / 10000);
    }
    case "fixed":
      return base - Math.min(toCents(offer.value) * quantity, base);
    case "bundle": {
      const qty = offer.bundle_quantity ?? 0;
      const bundle = toCents(offer.bundle_price);
      if (qty < 2 || quantity < qty || bundle >= unit * qty) return null;
      return Math.floor(quantity / qty) * bundle + (quantity % qty) * unit;
    }
  }
}

/** Quantity at which an offer is shown (bundle size, otherwise 1). */
export function offerQuantity(offer: PublicOffer): number {
  return offer.type === "bundle" ? (offer.bundle_quantity ?? 2) : 1;
}

export type OfferDisplay = {
  offer: PublicOffer;
  quantity: number;
  total: number;
  unit: number;
  original: number;
  savings: number;
  savingsPercent: number;
};

export function describeOffer(offer: PublicOffer, product: Pick<PublicProduct, "price">): OfferDisplay | null {
  const quantity = offerQuantity(offer);
  const total = offerTotalCents(offer, product.price, quantity);
  if (total === null) return null;
  const original = toCents(product.price) * quantity;
  const savings = Math.max(0, original - total);
  return {
    offer,
    quantity,
    total: fromCents(total),
    unit: fromCents(Math.round(total / quantity)),
    original: fromCents(original),
    savings: fromCents(savings),
    savingsPercent: original > 0 ? Math.round((savings / original) * 100) : 0,
  };
}

/** Best single-unit offer for headline prices (percentage/fixed only; bundles need a quantity). */
export function bestUnitOffer(offers: PublicOffer[], product: Pick<PublicProduct, "price">): OfferDisplay | null {
  let best: OfferDisplay | null = null;
  for (const offer of activeOffers(offers)) {
    if (offer.type === "bundle") continue;
    const display = describeOffer(offer, product);
    if (display && display.savings > 0 && (!best || display.total < best.total)) best = display;
  }
  return best;
}
