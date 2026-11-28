"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCompare } from "@/lib/store/compare";
import { ar } from "@/messages/ar";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import type { ProductCard } from "@/themes/store/shared/types";
import { useQuickAdd } from "@/themes/store/shared/use-quick-add";
import { installmentOf } from "./installments";
import { Photo, Stars } from "./parts";
import { useInstallments, useTeknoCard } from "./root";

const t = ar.teknoStore.card;

/** The card's chips: the merchant's «الحالة» row apart (drawn on the picture), the others in the chips line. */
export function splitChips(chips: ProductCard["spec_chips"], badgeLabel: string | null) {
  const all = chips ?? [];
  const badge = badgeLabel ? (all.find((c) => c.label.trim() === badgeLabel.trim()) ?? null) : null;
  return { badge, line: badge ? all.filter((c) => c !== badge) : all };
}

/**
 * «تيكنو»'s product card (the mockup's «اختار جهازك» grid): the photo on a light plate with the discount, «قارن»
 * and the condition badge; the name, spec chips, rating, price, then «أو X ج/شهر بدون فوايد» (installments on,
 * price over their minimum) or «فاضل N بس» (few units left), and a full «أضف للسلة». On a phone: the compact card of
 * the phone image (chips as one line, no button: the card opens the product).
 */
export function TeknoCard({ product }: { product: ProductCard }) {
  const look = useTeknoCard();
  const plan = useInstallments();
  const compare = useCompare();
  const hydrated = useHydrated();
  const { href, direct, inCart, add, note } = useQuickAdd(product);
  const [full, setFull] = React.useState(false);
  const { badge, line } = splitChips(product.spec_chips, look.badge_label);
  const sale = product.compare_at_price !== null && product.compare_at_price > product.price;
  const installment = look.show_installment ? installmentOf(product.price, plan) : null;
  const left = product.max_quantity ?? null;
  const low = !installment && look.low_stock > 0 && left !== null && left > 0 && left <= look.low_stock ? left : null;
  const compared = hydrated && compare.has(product.id);

  const toggleCompare = () => {
    const result = compare.toggle(product.id);
    setFull(result === "full");
  };

  const button = !product.available ? (
    <span className="tk-add pointer-events-none opacity-50">{t.soldOut}</span>
  ) : direct ? (
    <button type="button" onClick={add} className="tk-add as-sm" aria-label={inCart > 0 ? t.added(inCart) : `${t.add}: ${product.name}`} aria-live="polite">
      {inCart > 0 ? <Check className="size-4" aria-hidden /> : null}
      {inCart > 0 ? t.added(inCart) : t.add}
    </button>
  ) : (
    <StoreLink href={href} className="tk-add as-sm">
      {product.needs_options ? t.choose : t.add}
    </StoreLink>
  );

  return (
    <article className="tk-prod" style={{ borderRadius: look.radius }}>
      <div className="tk-prod-photo">
        <StoreLink href={href} className="absolute inset-0" aria-label={product.name}>
          <Photo urls={product.image?.urls} size="medium" alt={product.image?.alt ?? product.name} className="size-full" />
        </StoreLink>
        {product.discount_percent ? <span className="tk-off">{t.off(product.discount_percent)}</span> : null}
        {look.show_compare ? (
          <button type="button" onClick={toggleCompare} className="tk-cmp hidden @3xl:flex" aria-pressed={compared} aria-label={t.compareAdd(product.name)}>
            <i aria-hidden>{compared ? <Check className="size-2.5" strokeWidth={4} /> : null}</i>
            {t.compare}
          </button>
        ) : null}
        {badge ? <span className="tk-cond">{badge.value}</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 @3xl:gap-[0.45rem] @3xl:p-3">
        <StoreLink href={href} className="as-sm line-clamp-2 font-extrabold leading-snug hover:text-(--as-primary)">
          {product.name}
        </StoreLink>
        {look.show_specs && line.length ? (
          <>
            <ul className="tk-chips hidden @3xl:flex" aria-label={ar.specs.storefront.title}>
              {line.map((c, i) => (
                <li key={i} title={c.label}>
                  {c.value}
                </li>
              ))}
            </ul>
            <p className="as-xs as-muted truncate @3xl:hidden">{line.map((c) => c.value).join(" · ")}</p>
          </>
        ) : null}
        {look.show_rating && product.rating ? (
          <p className="as-xs tk-stars hidden items-center gap-1 @3xl:flex">
            <Stars value={product.rating.average} />
            <span>{t.reviews(product.rating.average, product.rating.count)}</span>
          </p>
        ) : null}
        <p className="flex flex-wrap items-baseline gap-x-2">
          <b className="tk-price as-sm @3xl:as-base">{formatMoney(product.price)}</b>
          {sale ? <s className="as-xs as-muted">{formatNumber(product.compare_at_price!)}</s> : null}
        </p>
        {installment ? (
          <p className="as-xs font-extrabold text-(--tk-green)">
            {t.installment(installment.amount)}
            {plan.interest_percent === 0 ? <span className="hidden @3xl:inline"> {t.noInterest}</span> : null}
          </p>
        ) : low !== null ? (
          <p className="as-xs font-extrabold text-(--tk-amber)">{t.low(low)}</p>
        ) : null}
        <div className="mt-auto hidden pt-1 @3xl:block">{button}</div>
        {note || full ? (
          <p className="as-xs font-semibold text-red-600" role="alert">
            {full ? t.compareFull : note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
