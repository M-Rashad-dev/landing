"use client";

import { Check, CircleAlert, ImageOff, MessageCircle, ShoppingBag, Tag, Zap, MailCheck } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { formatMoney } from "@/lib/format";
import { offerLabel } from "@/lib/store/offers";
import type { ProductPage } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { CustomerInputFields } from "@/themes/shared/customer-inputs";
import { pick } from "@/themes/shared/design";
import { useTheme } from "@/themes/store/shared/context";
import { useProductBuy } from "@/themes/store/shared/use-product-buy";
import { Breadcrumb, Container, QuantityStepper, Stars } from "../parts";
import { ProductCard } from "../product-card";
import { ProductReviewsSection } from "./reviews";
import { ProductSpecs } from "@/themes/store/shared/specs";

const t = ar.storefront.product;

export function ProductView({ page }: { page: ProductPage }) {
  const { product, breadcrumb, related } = page;
  const { settings } = useTheme();
  const buy = useProductBuy(page);
  const { chosen, choose, valueOut, price, compare, offerPrice, left, soldOut, low, inCart, room, add, message } = buy;
  const [image, setImage] = React.useState(0);
  const images = product.images;
  const current = images[Math.min(image, images.length - 1)];
  const live = buy.liveOffers;
  const soon = buy.soonOffers;
  const whatsapp = settings.footer.whatsapp;

  return (
    <Container className="flex flex-col gap-8 py-6 @3xl:py-8">
      <Breadcrumb items={[...breadcrumb.map((c) => ({ name: c.name, href: `/categories/${encodeURIComponent(c.slug)}` })), { name: product.name }]} />

      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2 @3xl:gap-10">
        {/* Images (min-w-0: a long thumbnail strip scrolls instead of widening the page) */}
        <div className="flex min-w-0 flex-col gap-3">
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
        <div className="flex min-w-0 flex-col gap-5">
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

          {product.options.map((option) => {
            const lacking = buy.lacking(option);
            return (
            <fieldset key={option.id} id={`opt-${option.id}`} className="flex min-w-0 scroll-mt-28 flex-col gap-2" aria-invalid={lacking || undefined}>
              <legend className={cn("as-sm mb-2 font-bold", lacking && "text-red-600")}>
                {option.name}
                {option.is_required ? <span className="text-red-600" aria-hidden> *</span> : null}
                {chosen[option.id] !== undefined ? <span className="as-muted font-normal">: {option.values.find((v) => v.id === chosen[option.id])?.label}</span> : null}
              </legend>
              {option.display_type === "dropdown" ? (
                <select
                  value={chosen[option.id] ?? ""}
                  onChange={(e) => choose(option.id, Number(e.target.value))}
                  aria-label={t.choose(option.name)}
                  className={cn("as-base h-11 rounded-lg border bg-(--as-bg) px-3", lacking && "border-red-500")}
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
                    return swatch ? (
                      // A color: a round chip; the chosen one gets a ring around it and a check.
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={out}
                        onClick={() => choose(option.id, v.id)}
                        title={v.label}
                        className={cn(
                          "relative flex size-11 items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-35",
                          selected ? "border-(--as-primary) ring-2 ring-(--as-primary) ring-offset-2 ring-offset-(--as-bg)" : lacking ? "border-red-500/70" : "border-transparent hover:border-(--as-primary)/50",
                        )}
                      >
                        <span className="size-8 rounded-full border border-black/10" style={{ background: v.color_hex! }} aria-hidden />
                        {selected ? (
                          <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary) shadow" aria-hidden>
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        ) : null}
                        <span className="sr-only">{v.label}</span>
                      </button>
                    ) : (
                      // A text choice: the chosen one is filled with the store color and checked.
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={out}
                        onClick={() => choose(option.id, v.id)}
                        title={v.label}
                        className={cn(
                          "as-sm flex items-center gap-2 rounded-lg border-2 px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
                          selected ? "border-(--as-primary) bg-(--as-primary) text-(--as-on-primary) shadow-sm" : lacking ? "border-red-500/70" : "hover:border-(--as-primary)/50",
                        )}
                      >
                        {selected ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
                        <span>{v.label}</span>
                        {v.price_delta ? <span className={cn("as-xs", selected ? "opacity-85" : "as-muted")}>{`${v.price_delta > 0 ? "+" : "−"}${formatMoney(Math.abs(v.price_delta))}`}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {lacking ? (
                <p className="as-xs flex items-center gap-1.5 font-semibold text-red-600" role="alert">
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                  {t.pickOne(option.name)}
                </p>
              ) : null}
            </fieldset>
            );
          })}

          {buy.digital ? <p className="as-xs as-muted flex items-center gap-1.5"><MailCheck className="size-4 shrink-0" aria-hidden />{ar.storefront.product.digitalNote}</p> : null}
          <CustomerInputFields state={buy.inputs} classes={{ label: "as-sm", control: "bg-(--as-bg) focus:border-(--as-primary) focus:outline-none" }} />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <QuantityStepper value={buy.quantity} onChange={buy.setQuantity} max={room} />
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

          <ProductSpecs specs={product.specs} titleClass="font-bold" />
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
