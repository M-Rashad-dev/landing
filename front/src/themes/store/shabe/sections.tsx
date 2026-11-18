"use client";

import { ChevronDown, Clock3, ImageOff, MapPin, Play, Star } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { offerLabel, offerQuantity } from "@/lib/store/offers";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { StoreAiSection } from "@/themes/store/shared/ai-section";
import { whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink } from "@/themes/store/shared/context";
import type { ProductCard } from "@/themes/store/shared/types";
import { pad, timeLeft, useNow } from "@/themes/store/shared/use-countdown";
import { useOpenNow } from "@/themes/store/shared/use-hours";
import type { ProductsProps, TestimonialsProps } from "../asas/types";
import { embedUrl, mapEmbed, youtubePoster, type CategoriesProps, type CountdownProps, type FaqProps, type GalleryProps, type LocationProps, type MarqueeProps, type TabsProps, type VideoProps } from "../sufi/types";
import { FoodCard } from "./card";
import { FoodIconView, useShabe } from "./root";
import type { BundleData, BundlesProps, FoodHeroProps, HoursProps, ShabeStoreSection, StepsProps, WhyProps } from "./types";

const t = ar.shabeStore;

/* ---------- shared pieces ---------- */

/** Picked images by id: the Builder's new picks first, else the design data. */
function useImage(): (id: number | null | undefined) => MediaUrls | null {
  const { media, data } = useShabe();
  return (id) => (id ? (media[String(id)] ?? data.media[String(id)] ?? null) : null);
}

function Photo({ urls, size = "large", alt = "", className }: { urls: MediaUrls | null; size?: "thumb" | "medium" | "large"; alt?: string; className?: string }) {
  const src = pick(urls, size);
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-(--ss-soft) as-muted", className)}>
        <ImageOff className="size-8" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}

function Head({ kicker, title, text, center = true }: { kicker?: string | null; title?: string | null; text?: string | null; center?: boolean }) {
  if (!kicker && !title && !text) return null;
  return (
    <div className={cn("flex flex-col gap-3", center && "items-center text-center")}>
      {kicker ? <span className="ss-kicker">{kicker}</span> : null}
      {title ? <h2 className="ss-display ss-title">{title}</h2> : null}
      {text ? <p className="as-lg as-muted max-w-2xl">{text}</p> : null}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-(--as-line)")} aria-hidden />
      ))}
    </span>
  );
}

/** What the Builder shows for a section that has nothing to show yet (nothing on the live store). */
function Empty({ text }: { text: string }) {
  const { mode } = useShabe();
  if (mode !== "builder") return null;
  return <p className="as-sm rounded-2xl border-2 border-dashed p-6 text-center as-muted">{text}</p>;
}

function Grid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @3xl:gap-5 @5xl:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <FoodCard product={p} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- 1. hero ---------- */

function FoodHero({ id, props }: { id: string; props: FoodHeroProps }) {
  const { data } = useShabe();
  const image = useImage()(props.media_id);
  const title = props.highlight && props.title.includes(props.highlight) ? props.title.split(props.highlight) : null;
  const primary = data.links[`${id}:primary`] ?? null;
  const second = data.links[`${id}:second`] ?? null;
  return (
    <section className="ss-hero relative overflow-hidden">
      <div className="ss-wrap grid items-center gap-8 pb-14 pt-8 @3xl:grid-cols-[1.05fr_1fr] @3xl:gap-12 @3xl:pb-20 @3xl:pt-14">
        <div className="flex flex-col gap-5">
          {props.kicker ? <span className="ss-kicker">{props.kicker}</span> : null}
          <h1 className="ss-display ss-hero-title">
            {title ? (
              <>
                {title[0]}
                <em className="not-italic text-(--as-primary)">{props.highlight}</em>
                {title.slice(1).join(props.highlight ?? "")}
              </>
            ) : (
              props.title
            )}
          </h1>
          {props.subtitle ? <p className="as-lg as-muted">{props.subtitle}</p> : null}
          <div className="flex flex-col gap-3 @xl:flex-row">
            <StoreLink href={primary} className="ss-btn ss-btn-fire as-lg h-14 px-8">
              {props.primary_label}
            </StoreLink>
            {props.second_label ? (
              <StoreLink href={second} className="ss-btn ss-btn-ghost as-lg h-14 px-8">
                {props.second_label}
              </StoreLink>
            ) : null}
          </div>
          {props.trust.length ? (
            <ul className="as-sm flex flex-wrap gap-x-5 gap-y-2 font-bold as-muted">
              {props.trust.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl border bg-(--as-bg) text-(--as-primary)">
                    <FoodIconView name={item.icon} className="size-4" />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative order-first @3xl:order-none">
          <Photo urls={image} alt={props.title} className="ss-plate aspect-[1/1.02] w-full" />
          {props.stickers[0] ? <span className="ss-sticker as-sm end-2 top-4 @3xl:-end-6 @3xl:top-10">{props.stickers[0]}</span> : null}
          {props.stickers[1] ? <span className="ss-sticker as-sm bottom-4 start-2 @3xl:-start-7 @3xl:bottom-16">{props.stickers[1]}</span> : null}
          {props.badge ? <span className="ss-badge ss-display as-xl end-2 top-[52%] @3xl:-end-8 @3xl:top-[46%]">{props.badge}</span> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. marquee ---------- */

const SPEEDS = { slow: "40s", normal: "28s", fast: "16s" } as const;

function Marquee({ props }: { props: MarqueeProps }) {
  const items = [...props.items, ...props.items, ...props.items, ...props.items];
  return (
    <div className="ss-marquee-clip">
      <div className="ss-marquee">
        <div className="ss-track ss-display as-2xl" style={{ "--ss-speed": SPEEDS[props.speed] } as React.CSSProperties}>
          {[0, 1].map((half) => (
            <React.Fragment key={half}>
              {items.map((item, i) => (
                <span key={`${half}-${i}`} aria-hidden={half === 1 || i >= props.items.length || undefined}>
                  {item}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. the menu's categories ---------- */

function Categories({ id, props }: { id: string; props: CategoriesProps }) {
  const { data } = useShabe();
  const tiles = data.category_tiles?.[id] ?? [];
  const cols = { "--cols": props.columns_mobile, "--cols-wide": props.columns_desktop } as React.CSSProperties;
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap flex flex-col gap-8">
        <Head title={props.title} text={props.description} />
        {tiles.length ? (
          <ul className={cn(props.layout === "slider" ? "flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]" : "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-4 @3xl:grid-cols-[repeat(var(--cols-wide),minmax(0,1fr))]")} style={cols}>
            {tiles.map((c) => (
              <li key={c.id} className={props.layout === "slider" ? "w-28 shrink-0 @3xl:w-36" : undefined}>
                <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="group flex flex-col items-center gap-2 text-center">
                  <span className="ss-cat-img block w-full" data-shape={props.shape}>
                    <Photo urls={c.image?.urls ?? null} size="medium" alt={c.name} className="size-full transition duration-500 group-hover:scale-105" />
                  </span>
                  <span className="ss-display as-base">{c.name}</span>
                </StoreLink>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={t.empty.categories} />
        )}
      </div>
    </section>
  );
}

/* ---------- 4. the menu with tabs ---------- */

function MenuTabs({ id, props }: { id: string; props: TabsProps }) {
  const { data } = useShabe();
  const [tab, setTab] = React.useState(0);
  const current = Math.min(tab, props.tabs.length - 1);
  const products = data.products[`${id}:${current}`] ?? [];
  return (
    <section className="ss-section ss-cream ss-reveal">
      <div className="ss-wrap flex flex-col gap-7">
        <Head title={props.title} text={props.description} />
        {props.tabs.length > 1 ? (
          <div className="ss-tabs justify-center" role="tablist">
            {props.tabs.map((x, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === current} onClick={() => setTab(i)} className="ss-tab as-sm">
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
        {products.length ? <Grid products={products} /> : <Empty text={t.empty.products} />}
      </div>
    </section>
  );
}

/* ---------- 5. packs tied to offers ---------- */

/** What a pack costs when its offer is a bundle for one product: n pieces at the bundle price. */
function packPrice(card: NonNullable<BundleData>): { now: number; was: number } | null {
  const { offer, product } = card;
  if (!product || offer.type !== "bundle" || !offer.bundle_price || !offer.bundle_quantity) return null;
  const quantity = offerQuantity(offer);
  return { now: offer.bundle_price * Math.floor(quantity / offer.bundle_quantity), was: product.price * quantity };
}

function Bundles({ id, props }: { id: string; props: BundlesProps }) {
  const { data } = useShabe();
  const image = useImage();
  const cards = data.bundles?.[id] ?? [];
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap flex flex-col gap-9">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        {props.cards.length ? (
          <ul className={cn("grid gap-5", props.cards.length >= 3 ? "@3xl:grid-cols-3" : props.cards.length === 2 ? "@3xl:grid-cols-2" : "mx-auto w-full max-w-md")}>
            {props.cards.map((card, i) => {
              const info = cards[i] ?? null;
              const price = info ? packPrice(info) : null;
              return (
                <li key={i} className={cn("ss-card relative flex flex-col overflow-hidden", card.ribbon && "ring-2 ring-(--as-primary)")}>
                  {card.ribbon ? <span className="as-xs absolute end-4 top-4 z-1 rounded-full bg-(--as-primary) px-3 py-1 font-extrabold text-(--as-on-primary)">{card.ribbon}</span> : null}
                  <Photo urls={image(card.media_id) ?? info?.product?.image?.urls ?? null} size="medium" alt={card.title} className="aspect-[16/10] w-full" />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h3 className="ss-display as-2xl">{card.title}</h3>
                      {card.subtitle ? <p className="as-sm as-muted">{card.subtitle}</p> : null}
                    </div>
                    {card.points.length ? (
                      <ul className="as-sm flex flex-col gap-1.5">
                        {card.points.map((point, j) => (
                          <li key={j} className="flex items-center gap-2">
                            <span className="size-1.5 shrink-0 rounded-full bg-(--as-primary)" aria-hidden />
                            {point}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-auto flex flex-col gap-3 pt-2">
                      {info ? (
                        price ? (
                          <p className="flex items-baseline gap-2">
                            <b className="as-2xl font-black">{formatMoney(price.now)}</b>
                            {price.was > price.now ? <s className="as-sm as-muted">{t.bundle.instead(price.was)}</s> : null}
                          </p>
                        ) : (
                          <p className="as-sm font-bold text-(--as-primary)">{info.offer.status === "scheduled" ? `${t.bundle.soon} · ${offerLabel(info.offer)}` : offerLabel(info.offer)}</p>
                        )
                      ) : (
                        <p className="as-sm font-bold as-muted">{t.bundle.gone}</p>
                      )}
                      {info ? (
                        <StoreLink href={info.href} className="ss-btn ss-btn-fire as-base h-12 w-full">
                          {card.button_label || t.bundle.pick}
                        </StoreLink>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty text={t.empty.bundles} />
        )}
      </div>
    </section>
  );
}

/* ---------- 6. a product list ---------- */

function Products({ id, props }: { id: string; props: ProductsProps }) {
  const { data } = useShabe();
  const products = data.products[id] ?? [];
  const all = props.show_view_all ? (data.view_all[id] ?? null) : null;
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap flex flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Head title={props.title} text={props.description} center={false} />
          {all ? (
            <StoreLink href={all} className="as-sm font-extrabold text-(--as-primary) hover:underline">
              {t.viewAll}
            </StoreLink>
          ) : null}
        </div>
        {products.length === 0 ? (
          <Empty text={t.empty.products} />
        ) : props.layout === "slider" ? (
          <ul className="ss-slider">
            {products.map((p) => (
              <li key={p.id}>
                <FoodCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <Grid products={products} />
        )}
      </div>
    </section>
  );
}

/* ---------- 7. why us ---------- */

function Why({ props }: { props: WhyProps }) {
  const image = useImage()(props.media_id);
  return (
    <section className="ss-dark ss-section">
      <div className={cn("ss-wrap grid items-center gap-8", image && "@3xl:grid-cols-[1fr_1.2fr] @3xl:gap-14")}>
        {image ? (
          <div className="relative overflow-hidden rounded-[1.8rem]">
            <Photo urls={image} className="aspect-[4/3] w-full @3xl:aspect-[4/5]" />
            {props.quote ? <p className="as-sm absolute inset-x-4 bottom-4 rounded-2xl bg-black/70 p-4 font-bold text-white backdrop-blur">{props.quote}</p> : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-6">
          <Head kicker={props.kicker} title={props.title} text={props.subtitle} center={!image} />
          <ul className="grid grid-cols-2 gap-3 @3xl:gap-4">
            {props.items.map((item, i) => (
              <li key={i} className="ss-card flex flex-col gap-2 p-4 @3xl:p-6">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-(--as-primary)/20 text-(--as-primary)">
                  <FoodIconView name={item.icon} className="size-6" />
                </span>
                <span className="ss-display as-xl mt-1">{item.title}</span>
                {item.text ? <span className="as-sm as-muted">{item.text}</span> : null}
              </li>
            ))}
          </ul>
          {!image && props.quote ? <p className="as-base text-center font-bold">{props.quote}</p> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. steps ---------- */

function Steps({ props }: { props: StepsProps }) {
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap">
        <Head kicker={props.kicker} title={props.title} />
        <ol className={cn("ss-steps mt-12 grid gap-10 @3xl:gap-6", props.items.length >= 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
          {props.items.map((item, i) => (
            <li key={i} className="relative flex flex-col items-center gap-2 text-center">
              <span className="relative z-1 flex size-22 items-center justify-center rounded-full border-[3px] border-(--as-primary) bg-(--as-bg) text-(--as-primary)">
                <FoodIconView name={item.icon} className="size-9" />
                <span className="as-sm absolute -end-1 -top-1 flex size-8 items-center justify-center rounded-full bg-(--as-primary) font-black text-(--as-on-primary)">{i + 1}</span>
              </span>
              <span className="ss-display as-xl mt-2">{item.title}</span>
              {item.text ? <span className="as-sm as-muted max-w-xs">{item.text}</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 9. countdown ---------- */

function Countdown({ id, props }: { id: string; props: CountdownProps }) {
  const { data, mode } = useShabe();
  const image = useImage()(props.media_id);
  const left = timeLeft(props.ends_at, useNow(mode !== "builder"));
  if (left?.ended && props.on_end === "hide" && mode !== "builder") return null;
  const parts = left ? [left.days, left.hours, left.minutes, left.seconds] : null;
  const labels = [t.units.days, t.units.hours, t.units.minutes, t.units.seconds];
  return (
    <section className="ss-section">
      <div className="ss-wrap">
        <div className={cn("ss-dark grid items-center gap-8 overflow-hidden rounded-[2rem] p-6 @3xl:p-12", image && "@3xl:grid-cols-[1.2fr_1fr]")}>
          <div className="flex flex-col gap-5">
            {props.kicker ? <span className="ss-kicker">{props.kicker}</span> : null}
            <h2 className="ss-display ss-title">{props.title}</h2>
            {props.text ? <p className="as-lg as-muted">{props.text}</p> : null}
            {left?.ended ? (
              <p className="ss-display as-2xl text-(--as-secondary)">{t.ended}</p>
            ) : (
              <div className="flex gap-2.5" dir="ltr">
                {labels.map((label, i) => (
                  <span key={label} className="flex w-18 flex-col items-center rounded-2xl bg-(--as-card) py-3">
                    <b className="as-2xl font-black tabular-nums">{parts ? pad(parts[i]) : "--"}</b>
                    <span className="as-xs as-muted">{label}</span>
                  </span>
                ))}
              </div>
            )}
            {props.button_label && !left?.ended ? (
              <StoreLink href={data.links[id] ?? null} className="ss-btn ss-btn-fire as-lg h-13 w-fit px-8">
                {props.button_label}
              </StoreLink>
            ) : null}
          </div>
          {image ? <Photo urls={image} className="aspect-square w-full rounded-[1.6rem]" /> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 10. video ---------- */

function Video({ props }: { props: VideoProps }) {
  const { mode } = useShabe();
  const cover = useImage()(props.cover_media_id);
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  const poster = pick(cover, "large") ?? youtubePoster(props.url);
  return (
    <section className="ss-section ss-cream ss-reveal">
      <div className="ss-wrap flex flex-col gap-7">
        <Head title={props.title} text={props.text} />
        <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[1.8rem] bg-black shadow-xl">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} className="group absolute inset-0" aria-label={t.video.play}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the merchant's cover or the video's own poster */}
              {poster ? <img src={poster} alt="" className="size-full object-cover opacity-85" /> : null}
              <span className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary) shadow-2xl transition group-hover:scale-110">
                <Play className="size-8 fill-current" aria-hidden />
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 11. gallery ---------- */

function Gallery({ id, props }: { id: string; props: GalleryProps }) {
  const { data } = useShabe();
  const image = useImage();
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap flex flex-col gap-7">
        <Head title={props.title} text={props.description} />
        {props.items.length ? (
          <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-4">
            {props.items.map((item, i) => (
              <li key={i} className={cn("group relative overflow-hidden rounded-[1.4rem]", i === 0 && "col-span-2 row-span-2")}>
                <StoreLink href={data.links[`${id}:${i}`] ?? null} className="block size-full">
                  <Photo urls={image(item.media_id)} size={i === 0 ? "large" : "medium"} alt={item.label ?? ""} className="aspect-square size-full transition duration-500 group-hover:scale-105" />
                  {item.label ? <span className="as-sm absolute inset-x-3 bottom-3 rounded-xl bg-black/65 px-3 py-2 font-bold text-white">{item.label}</span> : null}
                </StoreLink>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={t.empty.gallery} />
        )}
      </div>
    </section>
  );
}

/* ---------- 12. reviews ---------- */

function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data } = useShabe();
  const items = props.source === "auto" ? data.reviews : props.items;
  if (!items.length) return null;
  const average = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
  return (
    <section className="ss-section ss-cream ss-reveal">
      <div className="ss-wrap flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {props.title ? <h2 className="ss-display ss-title">{props.title}</h2> : null}
          <p className="as-sm flex items-center gap-2 font-bold as-muted">
            <Stars value={average} />
            {t.ratingLine(Math.round(average * 10) / 10, items.length)}
          </p>
        </div>
        <ul className="grid gap-4 @3xl:grid-cols-3">
          {items.slice(0, 9).map((r, i) => (
            <li key={i} className="ss-card flex flex-col gap-3 p-5">
              <Stars value={r.rating} />
              <p className="as-base leading-relaxed">{r.text}</p>
              <p className="ss-display as-lg mt-auto">{r.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 13. working hours ---------- */

function Hours({ props }: { props: HoursProps }) {
  const status = useOpenNow(props.days);
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap">
        <div className="ss-card mx-auto grid max-w-4xl gap-8 overflow-hidden p-6 @3xl:grid-cols-[1fr_1.1fr] @3xl:p-10">
          <div className="flex flex-col gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-(--ss-soft) text-(--as-primary)">
              <Clock3 className="size-7" aria-hidden />
            </span>
            {props.title ? <h2 className="ss-display ss-title">{props.title}</h2> : null}
            {props.subtitle ? <p className="as-base as-muted">{props.subtitle}</p> : null}
            {status ? (
              <div className={cn("flex flex-col gap-2 rounded-2xl p-4", status.open ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")} role="status">
                <p className="as-sm flex items-center gap-2 font-extrabold">
                  <span className="ss-dot" aria-hidden />
                  {status.open ? t.hours.openNow : t.hours.closedNow}
                </p>
                <p className="as-sm font-semibold">{status.open ? props.open_message : props.closed_message}</p>
              </div>
            ) : null}
          </div>
          <ul className="as-sm flex flex-col">
            {props.days.map((day, i) => (
              <li key={i} className={cn("flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0", status?.today === i && "font-extrabold text-(--as-primary)")}>
                <span>
                  {t.hours.days[i]}
                  {status?.today === i ? <span className="as-xs ms-2 rounded-full bg-(--ss-soft) px-2 py-0.5">{t.hours.today}</span> : null}
                </span>
                <span dir={day.open && day.from !== day.to ? "ltr" : undefined} className={cn(!day.open && "as-muted")}>
                  {!day.open ? t.hours.closed : day.from === day.to ? t.hours.allDay : t.hours.range(day.from, day.to)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- 14. questions ---------- */

function Faq({ props }: { props: FaqProps }) {
  const { settings } = useShabe();
  const [open, setOpen] = React.useState<number | null>(0);
  const number = settings.footer.whatsapp;
  return (
    <section className="ss-section ss-reveal">
      <div className="ss-wrap grid gap-8 @3xl:grid-cols-[1fr_1.6fr] @3xl:gap-14">
        <div className="flex flex-col gap-4">
          {props.title ? <h2 className="ss-display ss-title">{props.title}</h2> : null}
          {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
          {props.whatsapp_button && number ? (
            <a href={whatsappLink(number)} target="_blank" rel="noopener noreferrer" className="ss-btn ss-btn-ghost as-base h-12 w-fit px-6">
              {t.faq.whatsapp}
            </a>
          ) : null}
        </div>
        <ul className="flex flex-col gap-3">
          {props.items.map((qa, i) => (
            <li key={i} className="ss-qa ss-card overflow-hidden" data-open={open === i ? "" : undefined}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="as-base flex w-full items-center justify-between gap-3 p-5 text-start font-extrabold">
                {qa.question}
                <ChevronDown className={cn("size-5 shrink-0 transition", open === i && "rotate-180")} aria-hidden />
              </button>
              <div className="ss-qa-body">
                <div>
                  <p className="as-sm as-muted px-5 pb-5 leading-relaxed">{qa.answer}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 15. branches ---------- */

function Location({ props }: { props: LocationProps }) {
  const { mode } = useShabe();
  return (
    <section className="ss-section ss-cream ss-reveal">
      <div className="ss-wrap flex flex-col gap-8">
        <Head title={props.title} text={props.description} />
        <ul className={cn("grid gap-5", props.branches.length > 1 && "@3xl:grid-cols-2")}>
          {props.branches.map((b, i) => (
            <li key={i} className="ss-card flex flex-col overflow-hidden">
              {mode === "builder" ? (
                <span className="flex aspect-[16/9] items-center justify-center bg-(--ss-soft) as-muted">
                  <MapPin className="size-8" aria-hidden />
                </span>
              ) : (
                <iframe src={mapEmbed(b)} title={b.name} loading="lazy" className="aspect-[16/9] w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
              )}
              <div className="flex flex-col gap-1.5 p-5">
                <h3 className="ss-display as-xl">{b.name}</h3>
                <p className="as-sm as-muted">{b.address}</p>
                {b.hours ? <p className="as-sm">{b.hours}</p> : null}
                {b.phone ? (
                  <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="as-sm font-bold text-(--as-primary)" dir="ltr">
                    {b.phone}
                  </a>
                ) : null}
                <a href={b.map_url} target="_blank" rel="noopener noreferrer" className="as-sm mt-1 font-extrabold text-(--as-primary) hover:underline">
                  {t.location.open}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** One home section of «شابع». */
export function SectionView({ section }: { section: ShabeStoreSection }) {
  const id = section.id;
  switch (section.type) {
    case "food_hero":
      return <FoodHero id={id} props={section.props} />;
    case "marquee":
      return <Marquee props={section.props} />;
    case "categories":
      return <Categories id={id} props={section.props} />;
    case "product_tabs":
      return <MenuTabs id={id} props={section.props} />;
    case "bundles":
      return <Bundles id={id} props={section.props} />;
    case "products":
      return <Products id={id} props={section.props} />;
    case "why":
      return <Why props={section.props} />;
    case "steps":
      return <Steps props={section.props} />;
    case "countdown":
      return <Countdown id={id} props={section.props} />;
    case "video":
      return <Video props={section.props} />;
    case "gallery":
      return <Gallery id={id} props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "hours":
      return <Hours props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "location":
      return <Location props={section.props} />;
    case "ai":
      return <StoreAiSection section={section} themeKey="shabe_store" />;
  }
}
