"use client";

import { Check, ImageOff, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { StoreLink } from "@/themes/store/shared/context";
import { useQuickAdd } from "@/themes/store/shared/use-quick-add";
import { Stars } from "../asas/parts";
import { pick } from "@/themes/shared/design";
import type { SufiCard } from "./types";

const t = ar.sufi;

/** «صوفي»'s product card: the second picture on hover, the discount, and «أضف للسلة» over the image. */
export function ProductCard({ product }: { product: SufiCard }) {
  const { href, direct, inCart, add, note } = useQuickAdd(product);
  const image = pick(product.image?.urls, "medium");
  const second = pick(product.image_2?.urls, "medium");

  const button = "sf-btn sf-btn-ink as-sm h-11 w-full";
  return (
    <article className="sf-card group">
      <div className="sf-ph">
        <StoreLink href={href} className="absolute inset-0" aria-label={product.name}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
            <img src={image} alt={product.image?.alt ?? product.name} loading="lazy" />
          ) : (
            <span className="flex size-full items-center justify-center opacity-40">
              <ImageOff className="size-8" aria-hidden />
            </span>
          )}
          {second ? (
            // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
            <img src={second} alt="" loading="lazy" className="sf-alt" aria-hidden />
          ) : null}
        </StoreLink>
        {product.discount_percent ? <span className="as-xs absolute start-3 top-3 rounded-full bg-[#d9472b] px-2.5 py-1 font-bold text-white">{t.off(product.discount_percent)}</span> : null}
        {!product.available ? <span className="as-xs absolute end-3 top-3 rounded-full bg-black/70 px-2.5 py-1 font-bold text-white">{t.outOfStock}</span> : null}
        {product.available ? (
          <div className="sf-quick">
            {direct ? (
              <button type="button" onClick={add} className={button} aria-live="polite">
                {inCart > 0 ? <Check className="size-4" aria-hidden /> : <ShoppingBag className="size-4" aria-hidden />}
                {inCart > 0 ? ar.storefront.product.inCart(inCart) : t.quickAdd}
              </button>
            ) : (
              <StoreLink href={href} className={button}>
                <ShoppingBag className="size-4" aria-hidden />
                {product.needs_options ? t.chooseOptions : t.quickAdd}
              </StoreLink>
            )}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <StoreLink href={href} className="as-sm line-clamp-2 font-bold hover:underline">
          {product.name}
        </StoreLink>
        {product.rating ? (
          <p className="as-xs flex items-center gap-1 opacity-70">
            <Stars value={product.rating.average} size="size-3.5" label={ar.storefront.reviews.outOf(product.rating.average)} />
            <span>({product.rating.count})</span>
          </p>
        ) : null}
        <p className="mt-auto flex flex-wrap items-baseline gap-2">
          <span className={product.compare_at_price && product.compare_at_price > product.price ? "as-base font-bold text-[#d9472b]" : "as-base font-bold"}>{formatMoney(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price ? <span className="as-xs line-through opacity-50">{formatMoney(product.compare_at_price)}</span> : null}
        </p>
        {note ? (
          <p className="as-xs font-semibold text-red-600" role="alert">
            {note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
