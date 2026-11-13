"use client";

import { Banknote, ImageOff, Plus, Star, Truck } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { activeOffers, unitPriceAfter } from "@/lib/store/offers";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { FEATURE_ICONS } from "@/themes/asas/icons";
import { imageSrc, scrollToOrder, useImage, usePage, useProductImages } from "./context";
import type { FaqProps, FeaturesProps, GalleryProps, HeroProps, TestimonialsProps } from "./types";

const t = ar.bidaya;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="as-2xl mb-6 text-center font-extrabold">{children}</h2>;
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-(--as-line)")} aria-hidden />
      ))}
    </span>
  );
}

/** The product's price now (after the best running offer) and what it was. */
export function usePrice(): { now: number; was: number | null } | null {
  const { data } = usePage();
  const product = data.product;
  if (!product) return null;
  const offer = unitPriceAfter(activeOffers(data.offers), product.price);
  const now = offer ?? product.price;
  const was = offer !== null ? product.price : product.compare_at_price && product.compare_at_price > product.price ? product.compare_at_price : null;
  return { now, was };
}

export function Hero({ props }: { props: HeroProps }) {
  const { mode, data } = usePage();
  const own = useImage(props.image_media_id);
  const fallback = useProductImages()[0] ?? null;
  const image = imageSrc(own ?? fallback, "large");
  const price = usePrice();
  const rating = data.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : null;
  const off = price?.was ? Math.round(((price.was - price.now) / price.was) * 100) : null;

  return (
    <section className="px-4 py-8 @3xl:py-14">
      <div className="mx-auto grid max-w-5xl items-center gap-6 @3xl:grid-cols-2 @3xl:gap-10">
        <div className="relative overflow-hidden rounded-2xl bg-(--as-soft) @3xl:order-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
            <img src={image} alt={props.title} className="aspect-square w-full object-cover" />
          ) : (
            <span className="flex aspect-square w-full items-center justify-center as-muted">
              <ImageOff className="size-10" aria-hidden />
            </span>
          )}
          {props.badge ? <span className="bd-chip as-sm absolute start-3 top-3 bg-(--as-secondary) px-3 py-1 font-extrabold text-(--as-on-secondary)">{props.badge}</span> : null}
        </div>
        <div className="flex flex-col gap-4 @3xl:order-1">
          <h1 className="as-hero-title font-extrabold">{props.title}</h1>
          {props.subtitle ? <p className="as-hero-text as-muted">{props.subtitle}</p> : null}
          {rating !== null ? (
            <p className="as-sm flex items-center gap-2">
              <Stars value={rating} />
              <span className="as-muted">{t.rating(Math.round(rating * 10) / 10, data.reviews.length)}</span>
            </p>
          ) : null}
          {props.show_price && price ? (
            <p className="flex flex-wrap items-baseline gap-3">
              <span className="as-3xl font-extrabold as-primary">{formatMoney(price.now)}</span>
              {price.was ? <span className="as-lg as-muted line-through">{formatMoney(price.was)}</span> : null}
              {off ? <span className="bd-chip as-sm bg-(--as-soft) px-2 py-0.5 font-bold as-primary">{t.off(off)}</span> : null}
            </p>
          ) : null}
          <button type="button" onClick={() => scrollToOrder(mode)} className="as-btn as-lg bd-pulse h-13 w-full @3xl:w-fit @3xl:px-10">
            {props.button_label}
          </button>
          <ul className="as-sm as-muted flex flex-wrap gap-x-5 gap-y-1">
            <li className="flex items-center gap-1.5">
              <Banknote className="size-4 as-primary" aria-hidden />
              {t.form.cod}
            </li>
            <li className="flex items-center gap-1.5">
              <Truck className="size-4 as-primary" aria-hidden />
              {t.homeDelivery}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Features({ props }: { props: FeaturesProps }) {
  return (
    <section className="bg-(--as-soft) px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
        <ul className={cn("grid gap-3 @xl:grid-cols-2", props.items.length >= 3 && "@3xl:grid-cols-3")}>
          {props.items.map((item, i) => {
            const Icon = FEATURE_ICONS[item.icon] ?? Star;
            return (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-(--as-bg) p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary)" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="as-base font-bold">{item.title}</span>
                  {item.text ? <span className="as-sm as-muted">{item.text}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Gallery({ props }: { props: GalleryProps }) {
  const { data, media } = usePage();
  const productImages = useProductImages();
  const picked = props.image_media_ids.map((id) => media[String(id)] ?? data.media[String(id)]?.urls ?? null).filter((u) => u !== null);
  const images = picked.length ? picked : productImages;
  const [open, setOpen] = React.useState(0);
  if (images.length === 0) return null;
  const main = imageSrc(images[Math.min(open, images.length - 1)], "large");

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- store media, already resized */}
        <img src={main ?? ""} alt="" className="aspect-square w-full rounded-2xl object-cover @3xl:aspect-[4/3]" />
        {images.length > 1 ? (
          <div className="as-scroll mt-3 flex gap-2 overflow-x-auto">
            {images.map((urls, i) => (
              <button key={i} type="button" onClick={() => setOpen(i)} aria-label={t.gallery.image(i + 1)} aria-current={i === open} className={cn("size-16 shrink-0 overflow-hidden rounded-lg border-2 @3xl:size-20", i === open ? "border-(--as-primary)" : "border-transparent opacity-70 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- store media, already resized */}
                <img src={imageSrc(urls, "thumb") ?? ""} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data, mode } = usePage();
  const items = props.source === "auto" ? data.reviews : props.items;
  if (items.length === 0) {
    // Nothing to show yet: hidden on the live page, a hint in the Builder.
    if (mode === "live") return null;
    return (
      <section className="px-4 py-10">
        {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
        <p className="as-sm as-muted mx-auto max-w-md rounded-2xl border border-dashed p-6 text-center">{t.noReviewsYet}</p>
      </section>
    );
  }
  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
        <ul className="as-scroll flex gap-3 overflow-x-auto pb-2 @3xl:grid @3xl:grid-cols-3 @3xl:overflow-visible">
          {items.map((item, i) => (
            <li key={i} className="bd-card flex w-[80%] shrink-0 flex-col gap-3 p-5 @3xl:w-auto">
              <Stars value={item.rating} />
              <p className="as-sm leading-relaxed">«{item.text}»</p>
              <p className="as-sm mt-auto font-bold">{item.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq({ props }: { props: FaqProps }) {
  return (
    <section className="bg-(--as-soft) px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
        <div className="flex flex-col gap-2">
          {props.items.map((item, i) => (
            <details key={i} className="bd-faq rounded-xl bg-(--as-bg) px-4 py-3" open={i === 0}>
              <summary className="as-base flex items-center justify-between gap-3 font-bold">
                {item.question}
                <Plus className="bd-faq-icon size-5 shrink-0 as-primary transition-transform" aria-hidden />
              </summary>
              <p className="as-sm as-muted mt-2 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
