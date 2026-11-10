"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { OptionSelector } from "@/themes/shared/components/option-selector";
import { Price } from "@/themes/shared/components/price";
import { QuantityStepper } from "@/themes/shared/components/quantity-stepper";
import { AddToCartButton } from "@/themes/shared/store/add-to-cart-button";
import { storePaths } from "@/themes/shared/store/links";
import { MAX_LINE_QUANTITY, type CartItem } from "@/lib/store/cart";
import type { PublicOffer, PublicProduct } from "@/themes/types";

const t = siteMessages.store;

export type PurchaseProduct = PublicProduct & { slug?: string | null; stock_mode?: "unlimited" | "product" | "variant"; stock?: number | null; variant_stock?: Record<string, number> | null };

/** Units left for the current choice (null = not tracked / not known yet). */
export function unitsLeft(product: PurchaseProduct, selected: Record<number, number>): number | null {
  if (product.stock_mode === "product") return Math.max(0, product.stock ?? 0);
  if (product.stock_mode === "variant") {
    const required = product.options.filter((o) => o.is_required);
    const ids = required.map((o) => selected[o.id]);
    if (ids.some((id) => id === undefined)) return null;
    const key = [...(ids as number[])].sort((a, b) => a - b).join("-");
    return Math.max(0, product.variant_stock?.[key] ?? 0);
  }
  return null;
}

/** Price, options, quantity and the add-to-cart / buy-now buttons of a store product page. */
export function ProductPurchase({ product, offers, lowStock, buttonClassName, secondaryClassName }: { product: PurchaseProduct; offers: PublicOffer[]; lowStock: number | null; buttonClassName: string; secondaryClassName: string }) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const deltas = product.options.reduce((sum, option) => sum + (option.values.find((v) => v.id === selected[option.id])?.price_delta ?? 0), 0);
  const unit = Math.max(0, product.price + deltas);
  const left = unitsLeft(product, selected);
  const soldOut = !product.available || left === 0;
  const max = Math.min(MAX_LINE_QUANTITY, left ?? MAX_LINE_QUANTITY);

  function validate(): boolean {
    const missing: Record<number, string> = {};
    for (const option of product.options) if (option.is_required && selected[option.id] === undefined) missing[option.id] = siteMessages.chooseOption(option.name);
    setErrors(missing);
    return Object.keys(missing).length === 0;
  }

  const labels = product.options
    .map((o) => {
      const v = o.values.find((value) => value.id === selected[o.id]);
      return v ? `${o.name}: ${v.label}` : null;
    })
    .filter(Boolean)
    .join("، ");

  const item: CartItem = {
    product_id: product.id,
    quantity: Math.min(quantity, max),
    options: Object.fromEntries(Object.entries(selected)),
    name: product.name,
    slug: product.slug ?? null,
    image: product.images[0]?.urls.thumb ?? null,
    price: unit,
    options_label: labels,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Price price={unit} compareAt={product.compare_at_price !== null ? product.compare_at_price + deltas : null} showBadge priceClassName="text-3xl font-extrabold" />
      </div>
      {offers.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {offers.map((offer) => (
            <li key={offer.id} className="t-tint rounded-full px-3 py-1 text-xs font-semibold">
              {offer.badge_text || `${t.offer}: ${offer.name}`}
            </li>
          ))}
        </ul>
      ) : null}

      {product.options.map((option) => (
        <OptionSelector
          key={option.id}
          option={option}
          value={selected[option.id]}
          error={errors[option.id]}
          onChange={(valueId) => {
            setSelected((s) => ({ ...s, [option.id]: valueId }));
            setErrors((e) => ({ ...e, [option.id]: "" }));
          }}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">{t.quantity}</span>
        <QuantityStepper value={Math.min(quantity, Math.max(1, max))} onChange={setQuantity} min={1} max={Math.max(1, max)} disabled={soldOut} />
        {soldOut ? (
          <span className="text-sm font-bold text-red-600">{t.outOfStock}</span>
        ) : left !== null && lowStock !== null && left <= lowStock ? (
          <span className="text-sm font-semibold text-[var(--c-accent)]">{t.lowStock(left)}</span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AddToCartButton item={item} disabled={soldOut} validate={validate} className={cn(buttonClassName, "w-full")} label={soldOut ? t.outOfStock : t.addToCart} />
        <AddToCartButton
          item={item}
          disabled={soldOut}
          validate={validate}
          className={cn(secondaryClassName, "w-full")}
          label={t.buyNow}
          onAdded={() => window.location.assign(storePaths.checkout)}
        />
      </div>
      {quantity > 1 && !soldOut ? (
        <p className="t-muted text-sm">
          {t.lineTotal}: <strong>{formatPrice(unit * Math.min(quantity, max))}</strong>
        </p>
      ) : null}
    </div>
  );
}
