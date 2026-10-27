import type { Quote } from "@/lib/types";
import type { PublicOffer, PublicProduct } from "@/themes/types";
import { activeOffers } from "./offers";
import { fromCents, toCents } from "./index";

/**
 * Local estimate shown while the server quote is loading (same rules as
 * PriceCalculator for offers; codes are only applied by the server).
 */
export function estimateQuote(product: PublicProduct, offers: PublicOffer[], quantity: number, selected: Record<number, number>): Quote {
  const price = toCents(product.price);
  let deltas = 0;
  for (const option of product.options) {
    const value = option.values.find((v) => v.id === selected[option.id]);
    if (value) deltas += toCents(value.price_delta);
  }
  const unit = price + deltas;
  const base = unit * quantity;

  let best: { offer: PublicOffer; total: number } | null = null;
  for (const offer of activeOffers(offers)) {
    let total: number | null = null;
    if (offer.type === "percentage") total = base - Math.floor((base * Math.round((offer.value ?? 0) * 100) + 5000) / 10000);
    else if (offer.type === "fixed") total = base - Math.min(toCents(offer.value) * quantity, base);
    else {
      const qty = offer.bundle_quantity ?? 0;
      const bundle = toCents(offer.bundle_price);
      if (qty >= 2 && quantity >= qty && bundle < price * qty) total = Math.floor(quantity / qty) * bundle + (quantity % qty) * price + deltas * quantity;
    }
    if (total === null || total >= base) continue;
    if (!best || total < best.total || (total === best.total && (offer.priority > best.offer.priority || (offer.priority === best.offer.priority && offer.id < best.offer.id)))) {
      best = { offer, total };
    }
  }

  const after = best ? best.total : base;
  return {
    currency: "EGP",
    unit_price: fromCents(unit),
    quantity,
    base_subtotal: fromCents(base),
    offer: best ? { id: best.offer.id, name: best.offer.name, type: best.offer.type, discount: fromCents(base - best.total) } : null,
    subtotal_after_offer: fromCents(after),
    code: null,
    code_error: null,
    total: fromCents(Math.max(0, after)),
  };
}
