"use client";

import { Check, ImageOff, MessageCircle, ShoppingBag, Tag, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { formatMoney } from "@/lib/format";
import { addToCart, MAX_LINE_QUANTITY, quantityInCart, useCart } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { activeOffers, offerLabel, unitPriceAfter } from "@/lib/store/offers";
import type { ProductOption, ProductPage } from "@/lib/store/types";
import { track } from "@/lib/tracking/track";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useTheme } from "../context";
import { Breadcrumb, Container, QuantityStepper, Stars } from "../parts";
import { ProductCard } from "../product-card";
import { pick } from "../types";
import { ProductReviewsSection } from "./reviews";

const t = ar.storefront.product;

/** Variant stock key: the chosen values of the required options, sorted (back end: ProductVariant::keyFor). */
export function variantKey(options: ProductOption[], chosen: Record<number, number>): string | null {
  const ids: number[] = [];
  for (const option of options) {
    if (!option.is_required) continue;
    const value = chosen[option.id];
    if (value === undefined) return null;
    ids.push(value);
  }
  return ids.sort((a, b) => a - b).join("-");
}

/** Units the customer can buy with these choices (null = no limit, 0 = sold out). */
export function unitsLeft(page: ProductPage, chosen: Record<number, number>): number | null {
  const { product } = page;
  if (!product.available) return 0;
  if (product.stock_mode === "product") return product.stock ?? 0;
  if (product.stock_mode === "variant") {
    const key = variantKey(product.options, chosen);
    return key === null ? null : (product.variant_stock?.[key] ?? 0);
  }
  return null;
}

export function ProductView({ page }: { page: ProductPage }) {
  const { product, offers, breadcrumb, related } = page;
  const { settings } = useTheme();
  const router = useRouter();
  const [chosen, setChosen] = React.useState<Record<number, number>>(() => {
    // An option with a single value is chosen already.
    const start: Record<number, number> = {};
    for (const o of product.options) if (o.values.length === 1) start[o.id] = o.values[0].id;
    return start;
  });
  const [quantity, setQuantity] = React.useState(1);
  const [image, setImage] = React.useState(0);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    sendStoreEvent("product_view", String(product.id));
    // Pixels load after the page: give them a moment before the event.
    const timer = window.setTimeout(() => track("ViewContent", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 }), 1500);
    return () => window.clearTimeout(timer);
  }, [product.id, product.name, product.price]);

  const deltas = product.options.reduce((sum, o) => sum + (o.values.find((v) => v.id === chosen[o.id])?.price_delta ?? 0), 0);
  const price = Math.round((product.price + deltas) * 100) / 100;
  const compare = product.compare_at_price && product.compare_at_price > product.price ? product.compare_at_price + deltas : null;
  const offerPrice = unitPriceAfter(offers, price);
  const missing = product.options.filter((o) => o.is_required && chosen[o.id] === undefined);
  const left = unitsLeft(page, chosen);
  const soldOut = left === 0;
  const max = Math.max(1, Math.min(MAX_LINE_QUANTITY, left ?? MAX_LINE_QUANTITY));
  // What this choice already has in the cart, and how many more fit (the stock is the limit).
  const options = Object.fromEntries(Object.entries(chosen).map(([k, v]) => [k, v]));
  const inCart = quantityInCart(useCart(), { product_id: product.id, options });
  const room = Math.max(1, max - inCart);
  const low = left !== null && left > 0 && page.low_stock_threshold !== null && left <= page.low_stock_threshold;
  const images = product.images;
  const current = images[Math.min(image, images.length - 1)];
  const live = activeOffers(offers);
  const soon = offers.filter((o) => o.status === "scheduled");
  const whatsapp = settings.footer.whatsapp;

  /** A value is out when, with it, every required option is chosen and that combination has no units. */
  const valueOut = (option: ProductOption, valueId: number) => {
    if (product.stock_mode !== "variant" || !option.is_required) return false;
    const key = variantKey(product.options, { ...chosen, [option.id]: valueId });
    return key !== null && (product.variant_stock?.[key] ?? 0) <= 0;
  };

  const choose = (optionId: number, valueId: number) => {
    setChosen((c) => ({ ...c, [optionId]: valueId }));
    setMessage(null);
  };

  const add = (then: "cart" | "checkout") => {
    if (missing.length) {
      setMessage(t.pickAll);
      document.getElementById(`opt-${missing[0].id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    if (soldOut) return;
    const label = product.options
      .map((o) => {
        const v = o.values.find((x) => x.id === chosen[o.id]);
        return v ? `${o.name}: ${v.label}` : null;
      })
      .filter(Boolean)
      .join("، ");
    const result = addToCart({ product_id: product.id, quantity: Math.min(quantity, room), options, name: product.name, slug: product.slug, image: pick(images[0]?.urls, "thumb"), price, options_label: label, max: left });
    if (result === "full") {
      setMessage(t.cartFull);
      return;
    }
    if (result === "added") {
      sendStoreEvent("add_to_cart");
      track("AddToCart", { content_ids: [product.id], content_name: product.name, value: price * quantity, num_items: quantity });
      setQuantity(1);
    }
    // Already at the stock: «اشتري دلوقتي» still goes on to the checkout.
    if (then === "checkout") router.push("/checkout");
    else if (result === "max") setMessage(t.maxReached(inCart));
  };

  return (
    <Container className="flex flex-col gap-8 py-6 @3xl:py-8">
      <Breadcrumb items={[...breadcrumb.map((c) => ({ name: c.name, href: `/categories/${encodeURIComponent(c.slug)}` })), { name: product.name }]} />

      <div className="grid gap-6 @3xl:grid-cols-2 @3xl:gap-10">
        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border bg-(--as-soft)">
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
              <img src={pick(current.urls, "large") ?? ""} alt={current.alt ?? product.name} className="size-full object-contain" />
            ) : (
              <span className="flex size-full items-center justify-center as-muted">
                <ImageOff className="size-10" aria-hidden />
              </span>
            )}
            {compare ? <span className="as-sm absolute start-3 top-3 rounded-md bg-(--as-secondary) px-2 py-1 font-bold text-(--as-on-secondary)">{ar.storefront.off(Math.round(((compare - price) / compare) * 100))}</span> : null}
          </div>
          {images.length > 1 ? (
            <div className="as-scroll flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setImage(i)}
                  className={cn("size-16 shrink-0 overflow-hidden rounded-lg border-2 @3xl:size-20", i === image ? "border-(--as-primary)" : "border-transparent opacity-70 hover:opacity-100")}
                  aria-label={t.image(i + 1)}
                  aria-current={i === image}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- store images come from the media server */}
                  <img src={pick(img.urls, "thumb") ?? ""} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="as-2xl font-extrabold">{product.name}</h1>
            {page.rating.count > 0 ? (
              <a href="#reviews" className="as-xs as-muted flex w-fit items-center gap-1.5 hover:underline">
                <Stars value={page.rating.average} label={ar.storefront.reviews.outOf(page.rating.average)} />
                <span>
                  {page.rating.average} · {ar.storefront.reviews.count(page.rating.count)}
                </span>
              </a>
            ) : null}
            {product.short_description ? <p className="as-sm as-muted">{product.short_description}</p> : null}
            <p className="flex flex-wrap items-baseline gap-3">
              <span className="as-2xl font-extrabold as-primary">{formatMoney(offerPrice ?? price)}</span>
              {offerPrice !== null ? <span className="as-base as-muted line-through">{formatMoney(price)}</span> : compare ? <span className="as-base as-muted line-through">{formatMoney(compare)}</span> : null}
              {compare && offerPrice === null ? <span className="as-sm rounded-md bg-(--as-soft) px-2 py-0.5 font-bold as-primary">{t.save(formatMoney(compare - price))}</span> : null}
            </p>
            <p className={cn("as-sm font-semibold", soldOut ? "text-red-600" : low ? "text-amber-600" : "as-primary")}>{soldOut ? (product.available ? t.unavailable : t.soldOut) : low ? t.lowStock(left!) : t.inStock}</p>
          </div>

          {live.length || soon.length ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-(--as-primary)/50 bg-(--as-soft) p-3">
              <p className="as-sm flex items-center gap-1.5 font-bold">
                <Tag className="size-4 as-primary" aria-hidden />
                {t.offersTitle}
              </p>
              <ul className="flex flex-col gap-1.5">
                {live.map((offer) => (
                  <li key={offer.id} className="as-sm flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 as-primary" aria-hidden />
                    <span>
                      <b>{offer.name}</b> — {offerLabel(offer)}
                    </span>
                  </li>
                ))}
                {soon.map((offer) => (
                  <li key={offer.id} className="as-sm as-muted flex items-start gap-2">
                    <span className="as-xs mt-0.5 shrink-0 rounded bg-(--as-bg) px-1.5 font-bold">{t.offerSoon}</span>
                    <span>{offer.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {product.options.map((option) => (
            <fieldset key={option.id} id={`opt-${option.id}`} className="flex flex-col gap-2">
              <legend className="as-sm mb-2 font-bold">
                {option.name}
                {chosen[option.id] !== undefined ? <span className="as-muted font-normal">: {option.values.find((v) => v.id === chosen[option.id])?.label}</span> : null}
              </legend>
              {option.display_type === "dropdown" ? (
                <select
                  value={chosen[option.id] ?? ""}
                  onChange={(e) => choose(option.id, Number(e.target.value))}
                  aria-label={t.choose(option.name)}
                  className={cn("as-base h-11 rounded-lg border bg-(--as-bg) px-3", message && chosen[option.id] === undefined && option.is_required && "border-red-500")}
                >
                  <option value="" disabled>
                    {t.choose(option.name)}
                  </option>
                  {option.values.map((v) => (
                    <option key={v.id} value={v.id} disabled={valueOut(option, v.id)}>
                      {v.label}
                      {v.price_delta ? ` (${v.price_delta > 0 ? "+" : "−"}${formatMoney(Math.abs(v.price_delta))})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
                  {option.values.map((v) => {
                    const selected = chosen[option.id] === v.id;
                    const out = valueOut(option, v.id);
                    const swatch = option.display_type === "swatch" && v.color_hex;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={out}
                        onClick={() => choose(option.id, v.id)}
                        title={v.label}
                        className={cn(
                          "as-sm flex items-center gap-2 rounded-lg border-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
                          swatch ? "p-1" : "px-4 py-2",
                          selected ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/50",
                        )}
                      >
                        {swatch ? <span className="size-8 rounded-md border" style={{ background: v.color_hex! }} aria-hidden /> : null}
                        <span className={swatch ? "sr-only" : undefined}>{v.label}</span>
                        {v.price_delta && !swatch ? <span className="as-xs as-muted">{`${v.price_delta > 0 ? "+" : "−"}${formatMoney(Math.abs(v.price_delta))}`}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <QuantityStepper value={Math.min(quantity, room)} onChange={setQuantity} max={room} />
              <button type="button" onClick={() => add("cart")} disabled={soldOut} className="as-btn as-base h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-50" aria-live="polite">
                {inCart > 0 ? <Check className="size-5" aria-hidden /> : <ShoppingBag className="size-5" aria-hidden />}
                {inCart > 0 ? t.inCart(inCart) : ar.storefront.addToCart}
              </button>
            </div>
            <button
              type="button"
              onClick={() => add("checkout")}
              disabled={soldOut}
              className="as-base flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-(--as-primary) font-bold as-primary hover:bg-(--as-soft) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap className="size-5" aria-hidden />
              {t.buyNow}
            </button>
            {message ? (
              <p className="as-sm font-semibold text-red-600" role="alert">
                {message}
              </p>
            ) : null}
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, "").replace(/^0/, "20")}?text=${encodeURIComponent(t.askText(product.name))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="as-sm flex items-center justify-center gap-2 py-1 font-semibold as-muted hover:underline"
              >
                <MessageCircle className="size-4" aria-hidden />
                {t.shareWhatsapp}
              </a>
            ) : null}
          </div>

          {product.description ? (
            <section className="flex flex-col gap-2 border-t pt-5">
              <h2 className="as-lg font-bold">{t.description}</h2>
              <div className="as-prose as-sm">
                <ReactMarkdown>{product.description}</ReactMarkdown>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <ProductReviewsSection productId={product.id} slug={product.slug} summary={page.rating} />

      {related.length ? (
        <section className="flex flex-col gap-4 border-t pt-8">
          <h2 className="as-xl font-extrabold">{t.related}</h2>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-4">
            {related.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </Container>
  );
}
