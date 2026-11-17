"use client";

import { Check, ImageOff, Plus } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { pick } from "@/themes/shared/design";
import { StoreLink } from "@/themes/store/shared/context";
import type { ProductCard } from "@/themes/store/shared/types";
import { useQuickAdd } from "@/themes/store/shared/use-quick-add";
import { Stars } from "../asas/parts";

const t = ar.shabeStore;

/** «شابع»'s dish card: a big round-cornered photo, the name and short note, the price and a «+» to add. */
export function FoodCard({ product }: { product: ProductCard }) {
  const { href, direct, inCart, add, note } = useQuickAdd(product);
  const image = pick(product.image?.urls, "medium");
  const sale = product.compare_at_price && product.compare_at_price > product.price;
  return (
    <article className="ss-card ss-food group">
      <div className="ss-ph">
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
        <StoreLink href={href} className="ss-display as-lg line-clamp-2 leading-snug hover:text-(--as-primary)">
          {product.name}
        </StoreLink>
        {product.short_description ? <p className="as-xs as-muted line-clamp-2">{product.short_description}</p> : null}
        {product.rating ? (
          <p className="as-xs flex items-center gap-1 as-muted">
            <Stars value={product.rating.average} size="size-3.5" label={ar.storefront.reviews.outOf(product.rating.average)} />
            <span>({product.rating.count})</span>
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="flex flex-col leading-tight">
            <b className={sale ? "as-lg font-black text-(--as-primary)" : "as-lg font-black"}>{formatMoney(product.price)}</b>
            {sale ? <s className="as-xs as-muted">{formatMoney(product.compare_at_price!)}</s> : null}
          </p>
          {product.available ? (
            direct ? (
              <button type="button" onClick={add} className="ss-add as-sm" aria-label={inCart > 0 ? t.added(inCart) : `${t.add} ${product.name}`} aria-live="polite">
                {inCart > 0 ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {inCart > 0 ? <span>{inCart}</span> : null}
              </button>
            ) : (
              <StoreLink href={href} className="ss-add as-sm">
                {product.needs_options ? t.choose : <Plus className="size-4" aria-label={t.add} />}
              </StoreLink>
            )
          ) : null}
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
