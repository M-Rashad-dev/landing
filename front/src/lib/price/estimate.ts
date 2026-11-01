import type { Quote } from "@/lib/types";
import type { PublicOffer, PublicProduct } from "@/themes/types";
import { activeOffers, offerQuantity, pickOffer } from "./offers";
import { siteMessages } from "@/messages/site";
import { fromCents, toCents } from "./index";

/**
 * Local estimate shown while the server quote is loading (same rules as PriceCalculator for
 * offers; codes are only applied by the server). `chosenOffer`: the customer's pick in the offer
 * picker (0 = no offer); undefined = automatic.
 */
export function estimateQuote(product: PublicProduct, offers: PublicOffer[], quantity: number, selected: Record<number, number>, chosenOffer?: number | null): Quote {
  let deltas = 0;
  for (const option of product.options) {
    const value = option.values.find((v) => v.id === selected[option.id]);
    if (value) deltas += toCents(value.price_delta);
  }
  const unit = toCents(product.price) + deltas;
  const base = unit * quantity;

  const best = pickOffer(offers, product.price, quantity, deltas, chosenOffer);
  const chosen = chosenOffer ? activeOffers(offers).find((o) => o.id === chosenOffer) : undefined;
  const after = best ? best.total : base;
  return {
    currency: "EGP",
    unit_price: fromCents(unit),
    quantity,
    base_subtotal: fromCents(base),
    offer: best ? { id: best.offer.id, name: best.offer.name, type: best.offer.type, discount: fromCents(base - best.total) } : null,
    gift: best?.offer.type === "gift" && best.offer.gift ? { product_id: best.offer.gift.id, name: best.offer.gift.name, value: best.offer.gift.price } : null,
    offer_error: chosen && !best ? siteMessages.offerPicker.needs(offerQuantity(chosen)) : null,
    subtotal_after_offer: fromCents(after),
    code: null,
    code_error: null,
    total: fromCents(Math.max(0, after)),
  };
}
