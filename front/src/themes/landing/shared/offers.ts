"use client";

import * as React from "react";
import { activeOffers, offerQuantity } from "@/lib/store/offers";
import type { ProductOffer } from "@/lib/store/types";
import { scrollToOrder, type PageMode } from "@/themes/landing/bidaya/context";

/**
 * Offer cards and the order form of a landing page talk through one window event: a card picks
 * an offer (0 = one piece), the form selects it. Shared by every landing theme with offer cards.
 */
export const CHOOSE_OFFER_EVENT = "landing:choose-offer";

/** Picks the offer in the order form, then goes to the form (inert in the Builder). */
export function chooseOffer(id: number, mode: PageMode) {
  if (mode === "builder") return;
  window.dispatchEvent(new CustomEvent(CHOOSE_OFFER_EVENT, { detail: id }));
  scrollToOrder(mode);
}

/** Calls `on` each time a card picks an offer. */
export function useOfferChoice(on: (id: number) => void) {
  React.useEffect(() => {
    const listener = (e: Event) => on(Number((e as CustomEvent<number>).detail));
    window.addEventListener(CHOOSE_OFFER_EVENT, listener);
    return () => window.removeEventListener(CHOOSE_OFFER_EVENT, listener);
  }, [on]);
}

/* ---------- price of an offer (display only: the order form shows the server's price) ---------- */

export type Deal = { offer: ProductOffer | null; quantity: number; total: number; was: number };

/** What a card costs: the offer's quantity at the offer's price (same rules as App\Pricing\PriceMath). */
export function dealOf(offer: ProductOffer | null, price: number): Deal {
  const quantity = offer ? offerQuantity(offer) : 1;
  const was = price * quantity;
  let total = was;
  if (offer) {
    const v = offer.value ?? 0;
    switch (offer.type) {
      case "percentage":
        total = was - Math.round(was * v) / 100;
        break;
      case "fixed":
        total = was - Math.min(v * quantity, was);
        break;
      case "bundle": {
        const size = offer.bundle_quantity ?? 0;
        if (size >= 2 && quantity >= size) total = Math.floor(quantity / size) * (offer.bundle_price ?? 0) + (quantity % size) * price;
        break;
      }
      case "buy_get": {
        const buy = Math.max(1, offer.min_quantity ?? 1);
        const free = offer.free_quantity ?? 0;
        if (free > 0) total = (quantity - Math.floor(quantity / (buy + free)) * free) * price;
        break;
      }
      case "gift":
        break;
    }
  }
  return { offer, quantity, total: Math.max(0, Math.round(total * 100) / 100), was };
}

/** A card on the page: the merchant's own card (by offer id, null = one piece) or one per running offer. */
export type OfferCard<C> = { card: C | null; deal: Deal | null };

/**
 * The cards an offers section shows: the merchant's cards (a card whose offer stopped has no
 * deal), or — when there are none — the single piece and every running offer of the product.
 */
export function offerCards<C extends { offer_id: number | null }>(cards: C[], offers: ProductOffer[], price: number): OfferCard<C>[] {
  const running = activeOffers(offers);
  if (cards.length) {
    return cards.map((card) => {
      if (card.offer_id === null) return { card, deal: dealOf(null, price) };
      const offer = running.find((o) => o.id === card.offer_id);
      return { card, deal: offer ? dealOf(offer, price) : null };
    });
  }
  return [null, ...running].map((offer) => ({ card: null, deal: dealOf(offer, price) }));
}

/** The card to put forward: the merchant's first card with a ribbon, else the biggest deal that saves. */
export function highlightedCard<C extends { ribbon: string | null }>(shown: OfferCard<C>[], ownCards: boolean): number {
  if (ownCards) return shown.findIndex((c) => c.card?.ribbon);
  return shown.reduce<number>((at, c, i) => (c.deal && c.deal.total < c.deal.was && (at < 0 || (shown[at].deal?.quantity ?? 0) < c.deal.quantity) ? i : at), -1);
}
