"use client";

import type { ProductCard } from "@/themes/store/shared/types";
import { idList, useIdsFetch } from "./id-list";

/** «المفضلة»: up to 100 products the visitor saved, in their browser; no account needed (docs/plans/tekno/PLAN.md §2.3). */
export const MAX_WISHLIST = 100;

export const wishlist = idList("as_wishlist_v1", MAX_WISHLIST);

export function useWishlist() {
  const ids = wishlist.use();
  return {
    ids,
    count: ids.length,
    has: (id: number) => ids.includes(id),
    add: wishlist.add,
    remove: wishlist.remove,
    toggle: wishlist.toggle,
    clear: wishlist.clear,
  };
}

/** The saved products' cards (hidden or gone ones come back missing). */
export function useWishlistCards(ids: number[]) {
  return useIdsFetch<ProductCard[]>("/api/public/store/cards", ids);
}
