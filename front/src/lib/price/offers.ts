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

/**
 * Total after the offer for `quantity` units (unit = base price + option deltas; bundles charge
 * deltas on top), or null when it does not apply. A gift returns the base total (no discount).
 */
export function offerTotalCents(offer: PublicOffer, price: number, quantity: number, deltas = 0): number | null {
  const priceCents = toCents(price);
  const unit = priceCents + deltas;
  const base = unit * quantity;
  const min = Math.max(1, offer.min_quantity ?? 1);
  if ((offer.type === "percentage" || offer.type === "fixed" || offer.type === "gift") && quantity < min) return null;
  switch (offer.type) {
    case "gift":
      return offer.gift ? base : null;
    case "buy_get": {
      const free = offer.free_quantity ?? 0;
      if (free < 1) return null;
      const freeUnits = Math.floor(quantity / (min + free)) * free;
      return freeUnits === 0 ? null : (quantity - freeUnits) * unit;
    }
    case "percentage": {
      const pct = Math.round((offer.value ?? 0) * 100);
      return base - Math.floor((base * pct + 5000) / 10000);
    }
    case "fixed":
      return base - Math.min(toCents(offer.value) * quantity, base);
    case "bundle": {
      const qty = offer.bundle_quantity ?? 0;
      const bundle = toCents(offer.bundle_price);
      if (qty < 2 || quantity < qty || bundle >= priceCents * qty) return null;
      return Math.floor(quantity / qty) * bundle + (quantity % qty) * priceCents + deltas * quantity;
    }
  }
}

/** Quantity to order to get the offer (bundle size, buy + free, or the minimum quantity). */
export function offerQuantity(offer: PublicOffer): number {
  if (offer.required_quantity) return offer.required_quantity;
  if (offer.type === "bundle") return offer.bundle_quantity ?? 2;
  if (offer.type === "buy_get") return Math.max(1, offer.min_quantity ?? 1) + (offer.free_quantity ?? 0);
  return Math.max(1, offer.min_quantity ?? 1);
}

/**
 * The offer applied automatically, like PriceCalculator: merchant priority first, then the lowest
 * total (a gift counts its product's value), then the oldest id. `chosen` forces one offer (0 = none).
 */
export function pickOffer(offers: PublicOffer[], price: number, quantity: number, deltas = 0, chosen?: number | null): { offer: PublicOffer; total: number } | null {
  if (chosen === 0) return null;
  let best: { offer: PublicOffer; total: number; rank: number } | null = null;
  for (const offer of activeOffers(offers)) {
    if (chosen != null && offer.id !== chosen) continue;
    const total = offerTotalCents(offer, price, quantity, deltas);
    const base = (toCents(price) + deltas) * quantity;
    if (total === null || (offer.type !== "gift" && total >= base)) continue;
    const rank = total - (offer.type === "gift" ? toCents(offer.gift?.price) : 0);
    if (!best || isBetter(offer, rank, best)) best = { offer, total, rank };
  }
  return best ? { offer: best.offer, total: best.total } : null;
}

function isBetter(offer: PublicOffer, rank: number, best: { offer: PublicOffer; rank: number }): boolean {
  if (offer.priority !== best.offer.priority) return offer.priority > best.offer.priority;
  if (rank !== best.rank) return rank < best.rank;
  return offer.id < best.offer.id;
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
  // A gift saves the value of the free product.
  const savings = offer.type === "gift" ? toCents(offer.gift?.price) : Math.max(0, original - total);
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
    if (offer.type !== "percentage" && offer.type !== "fixed") continue;
    if ((offer.min_quantity ?? 1) > 1) continue;
    const display = describeOffer(offer, product);
    if (display && display.savings > 0 && (!best || display.total < best.total)) best = display;
  }
  return best;
}
