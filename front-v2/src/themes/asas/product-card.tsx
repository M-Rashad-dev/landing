"use client";

import { ImageOff, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { addToCart } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { track } from "@/lib/tracking/track";
import { ar } from "@/messages/ar";
import { StoreLink, useTheme } from "./context";
import { useShop } from "./shop";
import { pick, type ProductCard as Card } from "./types";

const t = ar.storefront;

export function ProductCard({ product }: { product: Card }) {
  const { mode } = useTheme();
  const shop = useShop();
  const href = `/products/${encodeURIComponent(product.slug)}`;
  const image = pick(product.image?.urls, "medium");
  // Nothing to choose: the card adds to the cart itself; otherwise it opens the product.
  const direct = mode === "live" && shop !== null && product.available && !product.needs_options;

  const add = () => {
    if (!addToCart({ product_id: product.id, quantity: 1, options: {}, name: product.name, slug: product.slug, image: pick(product.image?.urls, "thumb"), price: product.price, options_label: "" })) return;
    sendStoreEvent("add_to_cart");
    track("AddToCart", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 });
    shop?.openCart();
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border bg-(--as-card)">
      <StoreLink href={href} className="relative block aspect-square overflow-hidden bg-(--as-soft)">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
          <img src={image} alt={product.image?.alt ?? product.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex size-full items-center justify-center as-muted">
            <ImageOff className="size-8" aria-hidden />
          </span>
        )}
        {product.discount_percent ? (
          <span className="as-xs absolute start-2 top-2 rounded-md bg-(--as-secondary) px-2 py-0.5 font-bold text-(--as-on-secondary)">{t.off(product.discount_percent)}</span>
        ) : null}
        {!product.available ? <span className="as-xs absolute end-2 top-2 rounded-md bg-black/70 px-2 py-0.5 font-bold text-white">{t.outOfStock}</span> : null}
      </StoreLink>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <StoreLink href={href} className="as-sm line-clamp-2 font-semibold hover:underline">
          {product.name}
        </StoreLink>
        <p className="mt-auto flex flex-wrap items-baseline gap-2">
          <span className="as-base font-bold as-primary">{formatMoney(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price ? <span className="as-xs as-muted line-through">{formatMoney(product.compare_at_price)}</span> : null}
        </p>
        {direct ? (
          <button type="button" onClick={add} className="as-btn as-sm mt-1 w-full">
            <ShoppingBag className="size-4" aria-hidden />
            {t.addToCart}
          </button>
        ) : (
          <StoreLink href={href} className="as-btn as-sm mt-1 w-full" aria-disabled={!product.available || undefined}>
            <ShoppingBag className="size-4" aria-hidden />
            {product.available ? (product.needs_options ? t.chooseOptions : t.addToCart) : t.outOfStock}
          </StoreLink>
        )}
      </div>
    </article>
  );
}
