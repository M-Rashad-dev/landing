"use client";

import { Check, ImageOff, Plus, ShoppingBag } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick } from "@/themes/shared/design";
import { StoreLink } from "@/themes/store/shared/context";
import type { ProductCard } from "@/themes/store/shared/types";
import { useQuickAdd } from "@/themes/store/shared/use-quick-add";
import { Stars } from "../asas/parts";
import { useCardSettings } from "./root";

const t = ar.shabeStore;

const IMAGE = { square: "aspect-square", wide: "aspect-[16/10]", circle: "aspect-square" } as const;

/**
 * «شابع»'s dish card, as the merchant set it: the picture's shape (square, wide or a round plate),
 * the border (thickness, color or none), the corners, a shadow, the short note and rating, and
 * a small «+» or a full «أضف للسلة».
 */
export function FoodCard({ product }: { product: ProductCard }) {
  const look = useCardSettings();
  const { href, direct, inCart, add, note } = useQuickAdd(product);
  const image = pick(product.image?.urls, "medium");
  const sale = product.compare_at_price && product.compare_at_price > product.price;
  const circle = look.image === "circle";
  const style = {
    borderWidth: look.border_width,
    borderStyle: look.border_width ? "solid" : "none",
    borderColor: look.border_color ?? "var(--as-line)",
    borderRadius: look.radius,
  } as React.CSSProperties;
  const full = look.button === "full";

  const button = !product.available ? null : direct ? (
    <button type="button" onClick={add} className={cn("ss-add as-sm", full && "w-full")} aria-label={inCart > 0 ? t.added(inCart) : `${t.add} ${product.name}`} aria-live="polite">
      {inCart > 0 ? <Check className="size-4" aria-hidden /> : full ? <ShoppingBag className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      {full ? (inCart > 0 ? t.added(inCart) : ar.storefront.addToCart) : inCart > 0 ? <span>{inCart}</span> : null}
    </button>
  ) : (
    <StoreLink href={href} className={cn("ss-add as-sm", full && "w-full")}>
      {product.needs_options ? t.choose : full ? ar.storefront.addToCart : <Plus className="size-4" aria-label={t.add} />}
    </StoreLink>
  );

  return (
    <article className={cn("ss-food group bg-[color-mix(in_srgb,#fff_72%,var(--as-bg))]", look.shadow && "shadow-[0_18px_40px_-24px_rgb(60_25_5/0.45)]")} style={style}>
      <div className={cn("ss-ph", IMAGE[look.image], circle && "m-3 mb-0 rounded-full")} style={circle ? undefined : { borderStartStartRadius: look.radius, borderStartEndRadius: look.radius }}>
        <StoreLink href={href} className="absolute inset-0" aria-label={product.name}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
            <img src={image} alt={product.image?.alt ?? product.name} loading="lazy" />
          ) : (
            <span className="flex size-full items-center justify-center opacity-40">
              <ImageOff className="size-8" aria-hidden />
            </span>
          )}
        </StoreLink>
        {product.discount_percent ? <span className="as-xs absolute start-3 top-3 rounded-full bg-(--as-primary) px-2.5 py-1 font-extrabold text-(--as-on-primary)">{t.off(product.discount_percent)}</span> : null}
        {!product.available ? <span className="as-xs absolute end-3 top-3 rounded-full bg-black/75 px-2.5 py-1 font-bold text-white">{t.outOfStock}</span> : null}
      </div>
      <div className={cn("flex flex-1 flex-col gap-1.5 p-3.5 @3xl:p-4", circle && "items-center text-center")}>
        <StoreLink href={href} className="ss-display as-lg line-clamp-2 leading-snug hover:text-(--as-primary)">
          {product.name}
        </StoreLink>
        {look.show_description && product.short_description ? <p className="as-xs as-muted line-clamp-2">{product.short_description}</p> : null}
        {look.show_rating && product.rating ? (
          <p className="as-xs flex items-center gap-1 as-muted">
            <Stars value={product.rating.average} size="size-3.5" label={ar.storefront.reviews.outOf(product.rating.average)} />
            <span>({product.rating.count})</span>
          </p>
        ) : null}
        <div className={cn("mt-auto flex gap-2 pt-2", full || circle ? "w-full flex-col items-stretch" : "items-end justify-between")}>
          <p className={cn("flex flex-col leading-tight", circle && "items-center")}>
            <b className={sale ? "as-lg font-black text-(--as-primary)" : "as-lg font-black"}>{formatMoney(product.price)}</b>
            {sale ? <s className="as-xs as-muted">{formatMoney(product.compare_at_price!)}</s> : null}
          </p>
          {button}
        </div>
        {note ? (
          <p className="as-xs font-semibold text-red-600" role="alert">
            {note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
