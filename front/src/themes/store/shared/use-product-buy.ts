"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { addToCart, MAX_LINE_QUANTITY, quantityInCart, useCart } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { activeOffers, unitPriceAfter } from "@/lib/store/offers";
import type { ProductOption, ProductPage } from "@/lib/store/types";
import { track } from "@/lib/tracking/track";
import { toast } from "@/components/ui/feedback";
import { ar } from "@/messages/ar";
import { pick } from "../../shared/design";

const t = ar.storefront.product;

/** Variant stock key: the chosen values of the required options, sorted (back end: ProductVariant::keyFor). */
export function variantKey(options: ProductOption[], chosen: Record<number, number>): string | null {
  const ids: number[] = [];
  for (const option of options) {
    if (!option.is_required) continue;
    const value = chosen[option.id];
    if (value === undefined) return null;
    ids.push(value);
  }
  return ids.sort((a, b) => a - b).join("-");
}

/** Units the customer can buy with these choices (null = no limit, 0 = sold out). */
export function unitsLeft(page: ProductPage, chosen: Record<number, number>): number | null {
  const { product } = page;
  if (!product.available) return 0;
  if (product.stock_mode === "product") return product.stock ?? 0;
  if (product.stock_mode === "variant") {
    const key = variantKey(product.options, chosen);
    return key === null ? null : (product.variant_stock?.[key] ?? 0);
  }
  return null;
}

/**
 * Everything a product page does, whatever it looks like: the chosen options and quantity, the
 * price with option deltas and offers, the stock left, and adding to the cart or buying now (with
 * the store's counters and the merchant's pixels). The page only draws it.
 */
export function useProductBuy(page: ProductPage) {
  const { product, offers } = page;
  const router = useRouter();
  const [chosen, setChosen] = React.useState<Record<number, number>>(() => {
    // An option with a single value is chosen already.
    const start: Record<number, number> = {};
    for (const o of product.options) if (o.values.length === 1) start[o.id] = o.values[0].id;
    return start;
  });
  const [quantity, setQuantity] = React.useState(1);
  const [message, setMessage] = React.useState<string | null>(null);
  // Set when the customer tried to add without the required choices: those choices are marked.
  const [showMissing, setShowMissing] = React.useState(false);

  React.useEffect(() => {
    sendStoreEvent("product_view", String(product.id));
    // Pixels load after the page: give them a moment before the event.
    const timer = window.setTimeout(() => track("ViewContent", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 }), 1500);
    return () => window.clearTimeout(timer);
  }, [product.id, product.name, product.price]);

  const deltas = product.options.reduce((sum, o) => sum + (o.values.find((v) => v.id === chosen[o.id])?.price_delta ?? 0), 0);
  const price = Math.round((product.price + deltas) * 100) / 100;
  const compare = product.compare_at_price && product.compare_at_price > product.price ? product.compare_at_price + deltas : null;
  const offerPrice = unitPriceAfter(offers, price);
  const missing = product.options.filter((o) => o.is_required && chosen[o.id] === undefined);
  const left = unitsLeft(page, chosen);
  const soldOut = left === 0;
  const max = Math.max(1, Math.min(MAX_LINE_QUANTITY, left ?? MAX_LINE_QUANTITY));
  // What this choice already has in the cart, and how many more fit (the stock is the limit).
  const options = Object.fromEntries(Object.entries(chosen).map(([k, v]) => [k, v]));
  const inCart = quantityInCart(useCart(), { product_id: product.id, options });
  const room = Math.max(1, max - inCart);
  const low = left !== null && left > 0 && page.low_stock_threshold !== null && left <= page.low_stock_threshold;

  /** A value is out when, with it, every required option is chosen and that combination has no units. */
  const valueOut = (option: ProductOption, valueId: number) => {
    if (product.stock_mode !== "variant" || !option.is_required) return false;
    const key = variantKey(product.options, { ...chosen, [option.id]: valueId });
    return key !== null && (product.variant_stock?.[key] ?? 0) <= 0;
  };

  const choose = (optionId: number, valueId: number) => {
    setChosen((c) => ({ ...c, [optionId]: valueId }));
    setMessage(null);
  };

  const add = (then: "cart" | "checkout") => {
    if (missing.length) {
      // Each missing choice is marked where it is, a toast says what's missing, and the page goes to the first one.
      setShowMissing(true);
      setMessage(t.pickAll);
      toast.error(t.pickThese(missing.map((o) => o.name).join("، ")));
      document.getElementById(`opt-${missing[0].id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    if (soldOut) return;
    const label = product.options
      .map((o) => {
        const v = o.values.find((x) => x.id === chosen[o.id]);
        return v ? `${o.name}: ${v.label}` : null;
      })
      .filter(Boolean)
      .join("، ");
    const result = addToCart({ product_id: product.id, quantity: Math.min(quantity, room), options, name: product.name, slug: product.slug, image: pick(product.images[0]?.urls, "thumb"), price, options_label: label, max: left });
    if (result === "full") {
      setMessage(t.cartFull);
      return;
    }
    if (result === "added") {
      sendStoreEvent("add_to_cart");
      track("AddToCart", { content_ids: [product.id], content_name: product.name, value: price * quantity, num_items: quantity });
      setQuantity(1);
    }
    // Already at the stock: «اشتري دلوقتي» still goes on to the checkout.
    if (then === "checkout") router.push("/checkout");
    else if (result === "max") setMessage(t.maxReached(inCart));
  };

  return {
    chosen,
    choose,
    /** True for a required option the customer skipped after trying to add. */
    lacking: (option: ProductOption) => showMissing && option.is_required && chosen[option.id] === undefined,
    valueOut,
    quantity: Math.min(quantity, room),
    setQuantity,
    room,
    price,
    compare,
    offerPrice,
    left,
    soldOut,
    low,
    inCart,
    liveOffers: activeOffers(offers),
    soonOffers: offers.filter((o) => o.status === "scheduled"),
    add,
    message,
  };
}
