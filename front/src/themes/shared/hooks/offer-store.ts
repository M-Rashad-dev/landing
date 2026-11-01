"use client";

import { create } from "zustand";

/**
 * Tiny shared store linking offer cards to the order form:
 * clicking a bundle sets the form quantity and scrolls to #order.
 */
type OfferStore = {
  requestedQuantity: number | null;
  /** The offer behind the card (used when the form lets customers pick offers). */
  requestedOfferId: number | null;
  nonce: number;
  chooseQuantity: (quantity: number, offerId?: number | null) => void;
};

export const useOfferStore = create<OfferStore>((set) => ({
  requestedQuantity: null,
  requestedOfferId: null,
  nonce: 0,
  chooseQuantity: (quantity, offerId = null) => set((state) => ({ requestedQuantity: quantity, requestedOfferId: offerId, nonce: state.nonce + 1 })),
}));

export function chooseOfferQuantity(quantity: number, offerId?: number | null) {
  useOfferStore.getState().chooseQuantity(quantity, offerId);
  document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
