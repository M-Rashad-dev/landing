"use client";

import { ChevronLeft, ChevronRight, ImagePlus, PackageSearch, Quote, Star } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink, useTheme } from "./context";
import { Container } from "./parts";
import { FEATURE_ICONS } from "./icons";
import { ProductCard } from "./product-card";
import { pick, type BannerProps, type FeaturesProps, type ProductsProps, type TestimonialsProps } from "./types";

const t = ar.storefront;


/* ---------- بنر ---------- */

export function Banner({ id, props }: { id: string; props: BannerProps }) {
  const { data, media, mode } = useTheme();
  const slides = props.slides.filter((s) => pick(media[String(s.media_id)] ?? data.media[String(s.media_id)], "large"));
  const [index, setIndex] = React.useState(0);
  const count = slides.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const touchX = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!props.autoplay || count < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => window.clearInterval(timer);
  }, [props.autoplay, count]);

  if (count === 0) {
    // Nothing to show to customers; the Builder shows where the images go.
    if (mode !== "builder") return null;
    return (
      <Container className="py-4">
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed as-muted @3xl:aspect-21/8">
          <ImagePlus className="size-8" aria-hidden />
          <span className="as-sm">{t.empty.banner}</span>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div
        className="relative overflow-hidden rounded-2xl"
        aria-roledescription="carousel"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start === null || end === undefined || count < 2 || Math.abs(end - start) < 40) return;
          // Right to left page: the next slide sits on the left, so a swipe to the right brings it in.
          setIndex(end > start ? (current + 1) % count : (current - 1 + count) % count);
        }}
      >
        <div className="flex transition-transform duration-500" style={{ transform: `translateX(${current * 100}%)` }}>
          {slides.map((slide, i) => {
            const src = pick(media[String(slide.media_id)] ?? data.media[String(slide.media_id)], "large");
            const href = data.links[`${id}:${props.slides.indexOf(slide)}`] ?? null;
            const hasText = slide.title || slide.text || slide.button_label;
            return (
              <div key={`${slide.media_id}-${i}`} className="relative aspect-video w-full shrink-0 @3xl:aspect-21/8" aria-label={t.slide(i + 1)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- store images come from the media server */}
                <img src={src ?? ""} alt={slide.title ?? ""} className="size-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                {hasText ? (
                  <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 bg-linear-to-t from-black/60 via-black/10 to-transparent p-5 pb-9 text-white @3xl:justify-center @3xl:bg-linear-to-l @3xl:px-20 @3xl:py-12">
                    {slide.title ? <h2 className="as-hero-title font-extrabold">{slide.title}</h2> : null}
                    {slide.text ? <p className="as-hero-text max-w-md opacity-90">{slide.text}</p> : null}
                    {slide.button_label ? (
                      <StoreLink href={href} className="as-btn as-sm mt-1">
                        {slide.button_label}
                      </StoreLink>
                    ) : null}
                  </div>
                ) : href ? (
                  <StoreLink href={href} className="absolute inset-0" aria-label={slide.title ?? t.slide(i + 1)}>
                    <span className="sr-only">{t.slide(i + 1)}</span>
                  </StoreLink>
                ) : null}
              </div>
            );
          })}
        </div>
        {count > 1 ? (
          <>
            <button type="button" onClick={() => setIndex((current - 1 + count) % count)} className="absolute start-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black shadow @3xl:flex" aria-label={t.previous}>
              <ChevronRight className="size-5" />
            </button>
            <button type="button" onClick={() => setIndex((current + 1) % count)} className="absolute end-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black shadow @3xl:flex" aria-label={t.next}>
              <ChevronLeft className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <button key={i} type="button" onClick={() => setIndex(i)} className={cn("h-2 rounded-full transition-all", i === current ? "w-6 bg-white" : "w-2 bg-white/60")} aria-label={t.slide(i + 1)} aria-current={i === current} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Container>
  );
}

/* ---------- قائمة منتجات ---------- */

const GRID: Record<number, string> = {
  2: "@5xl:grid-cols-2",
  3: "@3xl:grid-cols-3",
  4: "@3xl:grid-cols-3 @5xl:grid-cols-4",
  5: "@3xl:grid-cols-3 @5xl:grid-cols-5",
};
const SLIDE: Record<number, string> = {
  2: "w-[46%] @3xl:w-[48%]",
  3: "w-[46%] @3xl:w-[32%]",
  4: "w-[46%] @3xl:w-[32%] @5xl:w-[24%]",
  5: "w-[46%] @3xl:w-[32%] @5xl:w-[19%]",
};

export function ProductList({ id, props }: { id: string; props: ProductsProps }) {
  const { data, mode, settings } = useTheme();
  const products = (data.products[id] ?? []).filter((p) => p.available || settings.general.show_out_of_stock);
  const rail = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8 * -1, behavior: "smooth" });

  if (products.length === 0 && mode !== "builder") return null;

  return (
    <Container className="py-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="as-xl font-extrabold">{props.title}</h2>
          {props.description ? <p className="as-sm as-muted mt-0.5">{props.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.layout === "slider" && products.length > 2 ? (
            <>
              <button type="button" onClick={() => scroll(-1)} className="flex size-8 items-center justify-center rounded-full border" aria-label={t.previous}>
                <ChevronRight className="size-4" />
              </button>
              <button type="button" onClick={() => scroll(1)} className="flex size-8 items-center justify-center rounded-full border" aria-label={t.next}>
                <ChevronLeft className="size-4" />
              </button>
            </>
          ) : null}
          {props.show_view_all ? (
            <StoreLink href={data.view_all[id] ?? "/products"} className="as-sm font-bold as-primary hover:underline">
              {t.viewAll}
            </StoreLink>
          ) : null}
        </div>
      </div>
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-10 as-muted">
          <PackageSearch className="size-7" aria-hidden />
          <span className="as-sm">{t.empty.products}</span>
        </div>
      ) : props.layout === "slider" ? (
        <div ref={rail} className="as-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {products.map((p) => (
            <div key={p.id} className={cn("shrink-0", SLIDE[props.columns] ?? SLIDE[4])}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-3 @3xl:gap-4", GRID[props.columns] ?? GRID[4])}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Container>
  );
}

/* ---------- مميزات المتجر ---------- */

export function Features({ props }: { props: FeaturesProps }) {
  const cols = props.items.length >= 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2";
  return (
    <Container className="py-8">
      {props.title ? <h2 className="as-xl mb-4 text-center font-extrabold">{props.title}</h2> : null}
      <div className={cn("grid grid-cols-2 gap-3 @3xl:gap-4", cols)}>
        {props.items.map((item, i) => {
          const Icon = FEATURE_ICONS[item.icon] ?? FEATURE_ICONS.star;
          return (
            <div key={i} className="flex flex-col items-center gap-2 rounded-xl bg-(--as-soft) p-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary)">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="as-sm font-bold">{item.title}</h3>
              {item.text ? <p className="as-xs as-muted">{item.text}</p> : null}
            </div>
          );
        })}
      </div>
    </Container>
  );
}

/* ---------- آراء العملاء ---------- */

export function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data, mode } = useTheme();
  const items = props.source === "auto" ? data.reviews : props.items;
  if (items.length === 0 && mode !== "builder") return null;

  return (
    <Container className="py-8">
      {props.title ? <h2 className="as-xl mb-4 text-center font-extrabold">{props.title}</h2> : null}
      {items.length === 0 ? (
        <p className="as-sm rounded-xl border-2 border-dashed py-8 text-center as-muted">{t.empty.reviews}</p>
      ) : (
        <div className="as-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {items.map((r, i) => (
            <figure key={i} className="flex w-[85%] shrink-0 flex-col gap-2 rounded-xl border bg-(--as-card) p-4 @3xl:w-[calc((100%-1.5rem)/3)]">
              <Quote className="size-5 as-primary" aria-hidden />
              <div className="flex gap-0.5" aria-label={t.stars(r.rating)}>
                {Array.from({ length: 5 }, (_, s) => (
                  <Star key={s} className={cn("size-4", s < r.rating ? "fill-(--as-secondary) text-(--as-secondary)" : "as-muted")} aria-hidden />
                ))}
              </div>
              <blockquote className="as-sm flex-1">{r.text}</blockquote>
              <figcaption className="as-sm font-bold">{r.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </Container>
  );
}
