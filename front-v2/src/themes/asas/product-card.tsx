"use client";

import { ImageOff, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { StoreLink, useTheme } from "./context";
import { pick, type ProductCard as Card } from "./types";

const t = ar.storefront;

export function ProductCard({ product }: { product: Card }) {
  const { settings } = useTheme();
  const href = `/products/${encodeURIComponent(product.slug)}`;
  const image = pick(product.image?.urls, "medium");
  if (!product.available && !settings.general.show_out_of_stock) return null;

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
        <StoreLink href={href} className="as-btn as-sm mt-1 w-full" aria-disabled={!product.available || undefined}>
          <ShoppingBag className="size-4" aria-hidden />
          {product.needs_options ? t.chooseOptions : t.addToCart}
        </StoreLink>
      </div>
    </article>
  );
}
