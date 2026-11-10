"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { addToCart, type CartItem } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { track } from "@/lib/tracking/track";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

const t = siteMessages.store;

/**
 * Adds a line to the visitor's cart (cart drawer/badge update through the cart store) and
 * reports AddToCart to the pixels and the store analytics. Disabled in the Builder preview.
 */
export function AddToCartButton({
  item,
  disabled = false,
  isPreview = false,
  className,
  label = t.addToCart,
  onAdded,
  validate,
}: {
  item: CartItem;
  disabled?: boolean;
  isPreview?: boolean;
  className?: string;
  label?: string;
  onAdded?: () => void;
  /** Runs before adding (e.g. required options); false stops it. */
  validate?: () => boolean;
}) {
  const [state, setState] = useState<"idle" | "added" | "full">("idle");

  function add() {
    if (isPreview || disabled) return;
    if (validate && !validate()) return;
    if (!addToCart(item)) {
      setState("full");
      return;
    }
    track("AddToCart", { content_ids: [item.product_id], content_name: item.name, value: item.price * item.quantity, num_items: item.quantity });
    sendStoreEvent("add_to_cart");
    setState("added");
    window.setTimeout(() => setState("idle"), 1800);
    onAdded?.();
  }

  return (
    <>
      <button type="button" onClick={add} disabled={disabled} aria-disabled={isPreview || undefined} className={cn("inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60", className)}>
        {state === "added" ? <Check className="size-4" aria-hidden /> : <ShoppingBag className="size-4" aria-hidden />}
        {state === "added" ? t.added : label}
      </button>
      <span role="status" className="sr-only">
        {state === "added" ? t.added : state === "full" ? t.cartFull : ""}
      </span>
      {state === "full" ? <p className="mt-1 text-xs text-[var(--c-accent)]">{t.cartFull}</p> : null}
    </>
  );
}
