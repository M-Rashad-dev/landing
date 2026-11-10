"use client";

import { ShoppingBag } from "lucide-react";
import { cartCount, useCart } from "@/lib/store/cart";
import { siteMessages } from "@/messages/site";
import { storePaths } from "@/themes/shared/store/links";

/** Header cart link with the live item count (from the visitor's saved cart). */
export function CartButton({ className, badgeClassName }: { className: string; badgeClassName: string }) {
  const count = cartCount(useCart());
  return (
    <a href={storePaths.cart} className={className} aria-label={`${siteMessages.store.cart} — ${siteMessages.store.cartCount(count)}`} data-testid="cart-button">
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 ? (
        <span className={badgeClassName} data-testid="cart-count">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </a>
  );
}
