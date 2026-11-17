"use client";

import * as React from "react";
import { addToCart, quantityInCart, useCart } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { track } from "@/lib/tracking/track";
import { ar } from "@/messages/ar";
import { pick } from "../../shared/design";
import { useTheme } from "./context";
import { useShop } from "./shop";
import type { ProductCard } from "./types";

/**
 * «أضف للسلة» from a product card, whatever the card looks like: only in the live store, for a
 * product that can be bought without choosing options (otherwise the card links to its page).
 */
export function useQuickAdd(product: ProductCard) {
  const { mode } = useTheme();
  const shop = useShop();
  const inCart = quantityInCart(useCart(), { product_id: product.id, options: {} });
  const [note, setNote] = React.useState<string | null>(null);

  const add = () => {
    const result = addToCart({ product_id: product.id, quantity: 1, options: {}, name: product.name, slug: product.slug, image: pick(product.image?.urls, "thumb"), price: product.price, options_label: "", max: product.max_quantity ?? null });
    if (result !== "added") {
      setNote(result === "max" ? ar.storefront.product.maxReached(inCart) : ar.storefront.product.cartFull);
      return;
    }
    setNote(null);
    sendStoreEvent("add_to_cart");
    track("AddToCart", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 });
  };

  return {
    href: `/products/${encodeURIComponent(product.slug)}`,
    /** True when the card adds by itself (else its button opens the product page). */
    direct: mode === "live" && shop !== null && product.available && !product.needs_options,
    inCart,
    add,
    note,
  };
}
