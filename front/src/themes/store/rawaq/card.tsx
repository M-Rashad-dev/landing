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
import { useRawaqCard } from "./root";

const t = ar.rawaqStore;

/** The soft plates a card's picture sits on, one after the other (tinted cards). */
const PLATES = ["var(--rq-blush)", "var(--rq-mint)", "var(--rq-sand)"];

/**
 * «رواق»'s product card, as the merchant set it: square or tall picture on a soft plate (or the
 * photo as it is), the corners, rating and short note, and a full «أضيفي للسلة» or a small «+».
 */
export function RawaqCard({ product, index = 0 }: { product: ProductCard; index?: number }) {
  const look = useRawaqCard();
  const { href, direct, inCart, add, note } = useQuickAdd(product);
  const image = pick(product.image?.urls, "medium");
  const sale = product.compare_at_price && product.compare_at_price > product.price;
  const full = look.button === "full";

  const button = !product.available ? null : direct ? (
    <button type="button" onClick={add} className={cn("rq-add as-sm", full && "w-full")} aria-label={inCart > 0 ? t.added(inCart) : `${t.add}: ${product.name}`} aria-live="polite">
      {inCart > 0 ? <Check className="size-4" aria-hidden /> : full ? <ShoppingBag className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      {full ? (inCart > 0 ? t.added(inCart) : t.add) : inCart > 0 ? <span>{inCart}</span> : null}
    </button>
  ) : (
    <StoreLink href={href} className={cn("rq-add as-sm", full && "w-full")}>
      {product.needs_options ? t.choose : full ? t.add : <Plus className="size-4" aria-label={t.addShort} />}
    </StoreLink>
  );

  return (
    <article className="rq-prod group" data-tinted={look.tinted ? "" : undefined} style={{ borderRadius: look.radius }}>
      <div className={cn("rq-ph", look.image === "tall" ? "aspect-[4/5]" : "aspect-square")} style={{ background: look.tinted ? PLATES[index % PLATES.length] : "var(--as-card)" }}>
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
      <div className="flex flex-1 flex-col gap-1.5 p-3.5 @3xl:p-4">
        <StoreLink href={href} className="as-base line-clamp-2 font-bold leading-snug hover:text-(--as-primary)">
          {product.name}
        </StoreLink>
        {look.show_rating && product.rating ? (
          <p className="as-xs flex items-center gap-1 as-muted">
            <Stars value={product.rating.average} size="size-3.5" label={ar.storefront.reviews.outOf(product.rating.average)} />
            <span>({product.rating.count})</span>
          </p>
        ) : null}
        {look.show_description && product.short_description ? <p className="as-xs as-muted line-clamp-2">{product.short_description}</p> : null}
        <div className={cn("mt-auto flex gap-2 pt-2", full ? "flex-col items-stretch" : "items-end justify-between")}>
          <p className="flex items-baseline gap-2">
            <b className="as-lg font-extrabold text-(--as-primary)">{formatMoney(product.price)}</b>
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
