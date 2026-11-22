"use client";

import { Check, ChevronLeft, Eye, ImageOff, MessageCircle, Minus, Plus, ShoppingBag, Tag, Zap } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { formatMoney } from "@/lib/format";
import { offerLabel } from "@/lib/store/offers";
import type { ProductPage } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { CustomerInputFields } from "@/themes/shared/customer-inputs";
import { pick } from "@/themes/shared/design";
import { whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink } from "@/themes/store/shared/context";
import { useProductBuy } from "@/themes/store/shared/use-product-buy";
import { useViewers } from "@/themes/store/shared/use-viewers";
import { Stars } from "../../asas/parts";
import { ProductReviewsSection } from "../../asas/pages/reviews";
import { FoodCard } from "../card";
import { usePageSettings, useShabe } from "../root";
import type { PageSettings } from "../types";

const t = ar.shabeStore;
const tp = ar.shabeStore.product;

type Image = ProductPage["product"]["images"][number];

/** A picture that zooms where the pointer is (when the merchant turned zoom on). */
function ZoomImage({ image, alt, zoom }: { image: Image | undefined; alt: string; zoom: boolean }) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  const src = pick(image?.urls, "large");
  if (!src) {
    return (
      <span className="flex size-full items-center justify-center as-muted">
        <ImageOff className="size-10" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn("block size-full overflow-hidden", zoom && "cursor-zoom-in")}
      onMouseMove={
        zoom
          ? (e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setOrigin(`${((e.clientX - box.left) / box.width) * 100}% ${((e.clientY - box.top) / box.height) * 100}%`);
            }
          : undefined
      }
      onMouseLeave={zoom ? () => setOrigin(null) : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- store images come from the media server */}
      <img src={src} alt={image?.alt ?? alt} className="size-full object-cover transition-transform duration-200" style={origin ? { transform: "scale(2.2)", transformOrigin: origin } : undefined} />
    </span>
  );
}

/** Big picture with thumbnails under it, or a swipeable slider with dots. */
function Gallery({ images, name, look }: { images: Image[]; name: string; look: PageSettings }) {
  const [current, setCurrent] = React.useState(0);
  const slider = React.useRef<HTMLDivElement>(null);
  const box = "relative aspect-square overflow-hidden rounded-[2rem] bg-(--ss-soft)";

  if (look.gallery === "slider" && images.length > 1) {
    return (
      <div className="flex flex-col gap-3">
        <div
          ref={slider}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-[2rem] [scrollbar-width:none]"
          onScroll={(e) => {
            const el = e.currentTarget;
            setCurrent(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
          }}
        >
          {images.map((img, i) => (
            <div key={img.id} className={cn(box, "w-full shrink-0 snap-start rounded-none")}>
              <ZoomImage image={img} alt={tp.image(i + 1)} zoom={look.zoom} />
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={tp.image(i + 1)}
              aria-current={i === current}
              onClick={() => slider.current?.children[i]?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "start" })}
              className={cn("h-2 rounded-full transition-all", i === current ? "w-6 bg-(--as-primary)" : "w-2 bg-(--as-line)")}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={box}>
        <ZoomImage image={images[Math.min(current, images.length - 1)]} alt={name} zoom={look.zoom} />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setCurrent(i)} aria-label={tp.image(i + 1)} aria-current={i === current} className={cn("size-18 shrink-0 overflow-hidden rounded-2xl border-2 transition", i === current ? "border-(--as-primary)" : "border-transparent opacity-70 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- store images come from the media server */}
              <img src={pick(img.urls, "thumb") ?? ""} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-12 items-center rounded-full border-2 bg-(--as-bg)" role="group" aria-label={tp.quantity}>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className="flex size-11 items-center justify-center rounded-full disabled:opacity-40" aria-label={tp.less}>
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="as-base w-8 text-center font-black tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="flex size-11 items-center justify-center rounded-full disabled:opacity-40" aria-label={tp.more}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * «شابع»'s product page, drawn on the shared product logic (useProductBuy): the gallery (with zoom),
 * the price, offers and choices as chips, the people watching now, «أضف للسلة» / «اشتري دلوقتي»,
 * a bar fixed at the bottom on phones, the description, reviews and «اطلبه مع» — each as the
 * merchant set it in «صفحة المنتج».
 */
export function ShabeProductView({ page }: { page: ProductPage }) {
  const { product, breadcrumb, related } = page;
  const { settings } = useShabe();
  const look = usePageSettings();
  const buy = useProductBuy(page);
  const viewers = useViewers(look.viewers);
  const { chosen, choose, valueOut, price, compare, offerPrice, left, soldOut, low, inCart, room, add, message } = buy;
  const whatsapp = look.whatsapp_ask ? settings.footer.whatsapp : null;
  const showCart = look.sticky_buttons !== "buy";
  const showBuy = look.sticky_buttons !== "cart";

  const cartButton = (cls: string) => (
    <button type="button" onClick={() => add("cart")} disabled={soldOut} className={cn("ss-btn ss-btn-fire as-base h-12 flex-1 disabled:opacity-50", cls)} aria-live="polite">
      {inCart > 0 ? <Check className="size-5" aria-hidden /> : <ShoppingBag className="size-5" aria-hidden />}
      {inCart > 0 ? t.added(inCart) : ar.storefront.addToCart}
    </button>
  );
  const buyButton = (cls: string, compact = false) => (
    <button type="button" onClick={() => add("checkout")} disabled={soldOut} className={cn("ss-btn ss-btn-ghost as-base h-12 flex-1 disabled:opacity-50", compact && "w-12 flex-none px-0", cls)} aria-label={compact ? tp.buyNow : undefined}>
      <Zap className="size-5" aria-hidden />
      {compact ? null : tp.buyNow}
    </button>
  );

  return (
    <div className={cn("ss-wrap flex flex-col gap-10 py-6 @3xl:py-10", look.sticky_bar && "pb-28 @3xl:pb-10")}>
      <nav className="as-sm flex flex-wrap items-center gap-1.5 as-muted" aria-label={ar.storefront.breadcrumb}>
        <StoreLink href="/" className="hover:text-(--as-primary)">
          {ar.storefront.home}
        </StoreLink>
        {breadcrumb.map((c) => (
          <React.Fragment key={c.slug}>
            <ChevronLeft className="size-3.5" aria-hidden />
            <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="hover:text-(--as-primary)">
              {c.name}
            </StoreLink>
          </React.Fragment>
        ))}
        <ChevronLeft className="size-3.5" aria-hidden />
        <span className="font-bold text-(--as-text)">{product.name}</span>
      </nav>

      <div className="grid gap-8 @3xl:grid-cols-2 @3xl:gap-12">
        <Gallery images={product.images} name={product.name} look={look} />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="ss-display ss-title">{product.name}</h1>
            {page.rating.count > 0 ? (
              <a href="#reviews" className="as-sm flex w-fit items-center gap-1.5 as-muted hover:underline">
                <Stars value={page.rating.average} label={ar.storefront.reviews.outOf(page.rating.average)} />
                {page.rating.average} · {ar.storefront.reviews.count(page.rating.count)}
              </a>
            ) : null}
            {product.short_description ? <p className="as-base as-muted">{product.short_description}</p> : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <b className="as-3xl font-black leading-none">{formatMoney(offerPrice ?? price)}</b>
            {offerPrice !== null ? <s className="as-lg as-muted">{formatMoney(price)}</s> : compare ? <s className="as-lg as-muted">{formatMoney(compare)}</s> : null}
            {compare && offerPrice === null ? <span className="as-sm rounded-full bg-(--as-secondary) px-3 py-1 font-extrabold text-(--as-on-secondary)">{tp.save(compare - price)}</span> : null}
          </div>

          <div className="as-sm flex flex-wrap items-center gap-x-4 gap-y-2 font-bold">
            <span className={soldOut ? "text-red-600" : low ? "text-amber-600" : "text-emerald-700"}>{soldOut ? (product.available ? tp.unavailable : tp.soldOut) : low ? tp.low(left!) : tp.inStock}</span>
            {viewers !== null ? (
              <span className="flex items-center gap-1.5 rounded-full bg-(--ss-soft) px-3 py-1 text-(--as-primary)" aria-live="off">
                <Eye className="size-4" aria-hidden />
                {tp.viewers(viewers)}
              </span>
            ) : null}
          </div>

          {buy.liveOffers.length || buy.soonOffers.length ? (
            <div className="flex flex-col gap-2 rounded-3xl border-2 border-dashed border-(--as-primary)/45 bg-(--ss-soft) p-4">
              <p className="as-sm flex items-center gap-1.5 font-extrabold">
                <Tag className="size-4 text-(--as-primary)" aria-hidden />
                {tp.offers}
              </p>
              {buy.liveOffers.map((offer) => (
                <p key={offer.id} className="as-sm">
                  <b>{offer.name}</b> — {offerLabel(offer)}
                </p>
              ))}
              {buy.soonOffers.map((offer) => (
                <p key={offer.id} className="as-sm as-muted">
                  {tp.soon} · {offer.name}
                </p>
              ))}
            </div>
          ) : null}

          {product.options.map((option) => {
            const lacking = buy.lacking(option);
            return (
              <fieldset key={option.id} id={`opt-${option.id}`} className={cn("flex flex-col gap-2 rounded-2xl", lacking && "-m-2 bg-red-500/5 p-2 ring-2 ring-red-500/70")} aria-invalid={lacking || undefined}>
                <legend className="as-sm mb-2 font-extrabold">
                  {option.name}
                  {option.is_required ? <span className="text-red-600" aria-hidden> *</span> : null}
                </legend>
                {option.display_type === "dropdown" ? (
                  <select value={chosen[option.id] ?? ""} onChange={(e) => choose(option.id, Number(e.target.value))} aria-label={tp.choose(option.name)} className="as-base h-12 rounded-2xl border-2 bg-(--as-bg) px-4">
                    <option value="" disabled>
                      {tp.choose(option.name)}
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
                      const on = chosen[option.id] === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={valueOut(option, v.id)}
                          onClick={() => choose(option.id, v.id)}
                          className={cn("as-sm flex items-center gap-2 rounded-full border-2 px-4 py-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through", on ? "border-(--as-primary) bg-(--as-primary) text-(--as-on-primary)" : "hover:border-(--as-primary)/50")}
                        >
                          {option.display_type === "swatch" && v.color_hex ? <span className="size-4 rounded-full border border-black/10" style={{ background: v.color_hex }} aria-hidden /> : null}
                          {v.label}
                          {v.price_delta ? <span className={cn("as-xs", on ? "opacity-85" : "as-muted")}>{`${v.price_delta > 0 ? "+" : "−"}${formatMoney(Math.abs(v.price_delta))}`}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                {lacking ? (
                  <p className="as-xs font-bold text-red-600" role="alert">
                    {ar.storefront.product.pickOne(option.name)}
                  </p>
                ) : null}
              </fieldset>
            );
          })}

          <CustomerInputFields state={buy.inputs} classes={{ label: "as-sm font-extrabold", control: "rounded-2xl border-2 bg-(--as-bg) focus:border-(--as-primary) focus:outline-none" }} />

          <div className="flex flex-wrap items-center gap-3">
            <Stepper value={buy.quantity} max={room} onChange={buy.setQuantity} />
            {cartButton("min-w-44")}
          </div>
          {buyButton("w-full flex-none")}
          {message ? (
            <p className="as-sm font-bold text-red-600" role="alert">
              {message}
            </p>
          ) : null}
          {whatsapp ? (
            <a href={whatsappLink(whatsapp, tp.askText(product.name))} target="_blank" rel="noopener noreferrer" className="as-sm flex w-fit items-center gap-2 font-bold as-muted hover:text-(--as-primary)">
              <MessageCircle className="size-4" aria-hidden />
              {tp.ask}
            </a>
          ) : null}

          {look.description && product.description ? (
            <section className="flex flex-col gap-2 border-t pt-5">
              <h2 className="ss-display as-xl">{tp.description}</h2>
              <div className="as-prose as-base">
                <ReactMarkdown>{product.description}</ReactMarkdown>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {look.reviews ? <ProductReviewsSection productId={product.id} slug={product.slug} summary={page.rating} /> : null}

      {look.related_enabled && related.length ? (
        <section className="flex flex-col gap-5 border-t pt-8">
          <h2 className="ss-display ss-title">{tp.related}</h2>
          <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-5">
            {related.slice(0, 8).map((p) => (
              <li key={p.id}>
                <FoodCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {look.sticky_bar ? (
        <div className="ss-sticky fixed inset-x-0 bottom-0 z-30 border-t bg-(--as-bg)/95 p-3 shadow-[0_-12px_30px_-20px_rgb(0_0_0/0.4)] backdrop-blur @3xl:hidden" role="region" aria-label={tp.quantity}>
          <div className="flex items-center gap-2">
            {showCart ? <Stepper value={buy.quantity} max={room} onChange={buy.setQuantity} /> : null}
            {showCart ? cartButton("min-w-0") : null}
            {/* Next to «أضف للسلة» on a phone there is room for the icon only (its name stays for screen readers). */}
            {showBuy ? buyButton("", showCart) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
