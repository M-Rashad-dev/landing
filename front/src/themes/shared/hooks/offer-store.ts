"use client";

import { create } from "zustand";

/**
 * Tiny shared store linking offer cards to the order form:
 * clicking a bundle sets the form quantity and scrolls to #order.
 */
type OfferStore = {
  requestedQuantity: number | null;
  nonce: number;
  chooseQuantity: (quantity: number) => void;
};

export const useOfferStore = create<OfferStore>((set) => ({
  requestedQuantity: null,
  nonce: 0,
  chooseQuantity: (quantity) => set((state) => ({ requestedQuantity: quantity, nonce: state.nonce + 1 })),
}));

export function chooseOfferQuantity(quantity: number) {
  useOfferStore.getState().chooseQuantity(quantity);
  document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
