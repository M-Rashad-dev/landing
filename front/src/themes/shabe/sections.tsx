"use client";

import { Check, ImageOff, Play, Plus, Star, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { activeOffers, offerQuantity } from "@/lib/store/offers";
import type { ProductOffer } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { MediaUrls } from "@/themes/asas/types";
import { imageSrc, scrollToOrder, useImage, usePage, useProductImages } from "@/themes/bidaya/context";
import { usePrice } from "@/themes/bidaya/sections";
import { embedUrl, youtubePoster } from "@/themes/sufi/types";
import { SHABE_ICONS } from "./icons";
import {
  CHOOSE_OFFER_EVENT,
  type BundlesProps,
  type CompareProps,
  type FaqProps,
  type GalleryProps,
  type GuaranteeProps,
  type HeroProps,
  type MarqueeProps,
  type MenuProps,
  type ShabeIcon,
  type StepsProps,
  type TestimonialsProps,
  type UrgencyProps,
  type VideoProps,
  type WhyProps,
} from "./types";

const t = ar.shabe;

/* ---------- shared pieces ---------- */

function Photo({ urls, size = "large", alt = "", className }: { urls: MediaUrls | null; size?: "thumb" | "medium" | "large"; alt?: string; className?: string }) {
  const src = imageSrc(urls, size);
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-(--as-soft) as-muted", className)}>
        <ImageOff className="size-8" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}

/** Picked images by id, from the Builder first, else the page data. */
function useImages(): (id: number | null | undefined) => MediaUrls | null {
  const { media, data } = usePage();
  return (id) => (id ? (media[String(id)] ?? data.media[String(id)]?.urls ?? null) : null);
}

export function Icon({ name, className }: { name: ShabeIcon; className?: string }) {
  const Glyph = SHABE_ICONS[name] ?? Star;
  return <Glyph className={className} aria-hidden />;
}

function Head({ kicker, title, text, center = true }: { kicker?: string | null; title?: string | null; text?: string | null; center?: boolean }) {
  if (!kicker && !title && !text) return null;
  return (
    <div className={cn("flex flex-col gap-3", center && "items-center text-center")}>
      {kicker ? <span className="sh-kicker">{kicker}</span> : null}
      {title ? <h2 className="sh-display sh-title">{title}</h2> : null}
      {text ? <p className="as-lg as-muted max-w-2xl">{text}</p> : null}
    </div>
  );
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

const tick = (live: boolean) => (onChange: () => void) => {
  if (!live) return () => {};
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
};

/** The time to the second in the browser (null while the server draws the page: no mismatch). */
export function useNow(live: boolean): number | null {
  const subscribe = React.useMemo(() => tick(live), [live]);
  return React.useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000) * 1000, () => null);
}

/** Days (only when there are some), hours, minutes and seconds left, or null before the browser knows. */
export function timeLeft(endsAt: string, now: number | null): { parts: Array<{ value: number; label: string }>; ended: boolean } | null {
  if (now === null) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  const days = Math.floor(left / 86400000);
  const parts = [
    { value: Math.floor(left / 3600000) % 24, label: t.units.hours },
    { value: Math.floor(left / 60000) % 60, label: t.units.minutes },
    { value: Math.floor(left / 1000) % 60, label: t.units.seconds },
  ];
  return { parts: days > 0 ? [{ value: days, label: t.units.days }, ...parts] : parts, ended: left === 0 };
}

export const pad = (n: number) => String(n).padStart(2, "0");

/* ---------- price of an offer (display only: the order form shows the server's price) ---------- */

export type Deal = { offer: ProductOffer | null; quantity: number; total: number; was: number };

/** What a card costs: the offer's quantity at the offer's price (same rules as App\Pricing\PriceMath). */
export function dealOf(offer: ProductOffer | null, price: number): Deal {
  const quantity = offer ? offerQuantity(offer) : 1;
  const was = price * quantity;
  let total = was;
  if (offer) {
    const v = offer.value ?? 0;
    switch (offer.type) {
      case "percentage":
        total = was - Math.round(was * v) / 100;
        break;
      case "fixed":
        total = was - Math.min(v * quantity, was);
        break;
      case "bundle": {
        const size = offer.bundle_quantity ?? 0;
        if (size >= 2 && quantity >= size) total = Math.floor(quantity / size) * (offer.bundle_price ?? 0) + (quantity % size) * price;
        break;
      }
      case "buy_get": {
        const buy = Math.max(1, offer.min_quantity ?? 1);
        const free = offer.free_quantity ?? 0;
        if (free > 0) total = (quantity - Math.floor(quantity / (buy + free)) * free) * price;
        break;
      }
      case "gift":
        break;
    }
  }
  return { offer, quantity, total: Math.max(0, Math.round(total * 100) / 100), was };
}

/* ---------- 1. hero ---------- */

export function Hero({ props, nextId }: { props: HeroProps; nextId: string | null }) {
  const { mode, data } = usePage();
  const own = useImage(props.image_media_id);
  const fallback = useProductImages()[0] ?? null;
  const price = usePrice();
  const rating = data.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : null;
  const off = price?.was ? Math.round(((price.was - price.now) / price.was) * 100) : null;
  const title = props.highlight && props.title.includes(props.highlight) ? props.title.split(props.highlight) : null;

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(70rem_30rem_at_85%_-10%,color-mix(in_srgb,var(--as-secondary)_30%,transparent),transparent_60%)] sh-cream">
      <div className="sh-wrap grid items-center gap-8 pb-14 pt-8 @3xl:grid-cols-[1.05fr_1fr] @3xl:gap-12 @3xl:pb-20 @3xl:pt-16">
        <div className="flex flex-col gap-5">
          {props.kicker ? <span className="sh-kicker">{props.kicker}</span> : null}
          <h1 className="sh-display sh-hero-title">
            {title ? (
              <>
                {title[0]}
                <em className="not-italic as-primary">{props.highlight}</em>
                {title.slice(1).join(props.highlight ?? "")}
              </>
            ) : (
              props.title
            )}
          </h1>
          {props.subtitle ? <p className="as-lg as-muted">{props.subtitle}</p> : null}
          {props.show_rating && rating !== null ? (
            <p className="as-sm flex items-center gap-2 font-bold as-muted">
              <Stars value={rating} />
              {t.ratingLine(Math.round(rating * 10) / 10, data.reviews.length)}
            </p>
          ) : null}
          {props.show_price && price ? (
            <p className="flex flex-wrap items-end gap-3">
              <b className="as-3xl font-black leading-none">{formatMoney(price.now)}</b>
              {price.was ? <s className="as-xl font-bold as-muted">{formatMoney(price.was)}</s> : null}
              {price.was ? <span className="as-sm mb-1 rounded-lg bg-(--as-secondary) px-3 py-1 font-extrabold text-(--as-on-secondary)">{t.save(price.was - price.now)}</span> : null}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 @xl:flex-row">
            <button type="button" onClick={() => scrollToOrder(mode)} className="as-btn sh-btn-fire as-lg h-14 px-8">
              {props.button_label}
            </button>
            {props.second_label && nextId ? (
              <button type="button" onClick={() => mode !== "builder" && document.getElementById(`section-${nextId}`)?.scrollIntoView({ behavior: "smooth" })} className="sh-btn-ghost as-lg h-14 px-8">
                {props.second_label}
              </button>
            ) : null}
          </div>
          {props.trust.length ? (
            <ul className="as-sm flex flex-wrap gap-x-5 gap-y-2 font-bold as-muted">
              {props.trust.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl border bg-(--as-bg) as-primary">
                    <Icon name={item.icon} className="size-4" />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative order-first @3xl:order-none">
          <Photo urls={own ?? fallback} alt={props.title} className="sh-plate aspect-[1/1.02] w-full" />
          {props.stickers[0] ? <span className="sh-sticker as-sm end-2 top-4 @3xl:-end-6 @3xl:top-10">{props.stickers[0]}</span> : null}
          {props.stickers[1] ? <span className="sh-sticker as-sm bottom-4 start-2 @3xl:-start-7 @3xl:bottom-16">{props.stickers[1]}</span> : null}
          {off || props.badge ? (
            <span className="sh-badge end-2 top-[52%] @3xl:-end-8 @3xl:top-[46%]">
              {off ? <b className="as-2xl font-black">{t.off(off)}</b> : null}
              {props.badge ? <span className="as-xs px-2">{props.badge}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. marquee ---------- */

export function Marquee({ props }: { props: MarqueeProps }) {
  const items = [...props.items, ...props.items, ...props.items, ...props.items];
  return (
    <div className="sh-marquee-clip">
      <div className="sh-marquee">
        <div className="sh-track sh-display as-2xl">
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

/* ---------- 3. menu: what's in the box ---------- */

export function Menu({ props }: { props: MenuProps }) {
  const image = useImages();
  const productImages = useProductImages();
  return (
    <section className="sh-section">
      <div className="sh-wrap">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        <ul className={cn("mt-10 grid grid-cols-2 gap-3 @3xl:gap-5", props.items.length >= 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "")}>
          {props.items.map((item, i) => (
            <li key={i} className="sh-card overflow-hidden">
              <span className="relative block">
                <Photo urls={image(item.image_media_id) ?? productImages[i % Math.max(1, productImages.length)] ?? null} size="medium" alt={item.title} className="aspect-[1/0.82] w-full" />
                {item.tag ? <span className="as-xs absolute bottom-2.5 start-2.5 rounded-full bg-black/80 px-3 py-1 font-extrabold text-white">{item.tag}</span> : null}
              </span>
              <span className="flex flex-col gap-1 p-3 text-center @3xl:p-4">
                <span className="sh-display as-xl">{item.title}</span>
                {item.text ? <span className="as-xs as-muted @3xl:as-sm">{item.text}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {props.extras.length ? (
          <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
            {props.extras.map((extra, i) => (
              <li key={i} className="as-sm rounded-full border border-dashed border-(--as-secondary) bg-(--as-soft) px-4 py-2 font-bold">
                {extra}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- 4. why us ---------- */

export function Why({ props }: { props: WhyProps }) {
  const own = useImage(props.image_media_id);
  const productImages = useProductImages();
  const fallback = productImages[1] ?? productImages[0] ?? null;
  const image = own ?? fallback;
  return (
    <section className="sh-dark sh-section">
      <div className={cn("sh-wrap grid items-center gap-8", image && "@3xl:grid-cols-[1fr_1.2fr] @3xl:gap-14")}>
        {image ? (
          <div className="relative overflow-hidden rounded-[1.8rem]">
            <Photo urls={image} className="aspect-[4/3] w-full @3xl:aspect-[4/5]" />
            {props.quote ? <p className="as-sm absolute inset-x-4 bottom-4 rounded-2xl bg-black/70 p-4 font-bold text-white backdrop-blur">{props.quote}</p> : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-6">
          <Head kicker={props.kicker} title={props.title} text={props.subtitle} center={false} />
          <ul className="grid grid-cols-2 gap-3 @3xl:gap-4">
            {props.items.map((item, i) => (
              <li key={i} className="sh-card flex flex-col gap-2 p-4 @3xl:p-6">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-(--as-primary)/20 text-(--as-primary)">
                  <Icon name={item.icon} className="size-6" />
                </span>
                <span className="sh-display as-xl mt-1">{item.title}</span>
                {item.text ? <span className="as-sm as-muted">{item.text}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. steps ---------- */

export function Steps({ props }: { props: StepsProps }) {
  return (
    <section className="sh-section">
      <div className="sh-wrap">
        <Head kicker={props.kicker} title={props.title} />
        <ol className={cn("sh-steps mt-12 grid gap-10 @3xl:gap-6", props.items.length === 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
          {props.items.map((item, i) => (
            <li key={i} className="relative flex flex-col items-center gap-2 text-center">
              <span className="relative z-1 flex size-22 items-center justify-center rounded-full border-[3px] border-(--as-primary) bg-(--as-bg) as-primary">
                <Icon name={item.icon} className="size-9" />
                <b className="as-sm absolute -end-1.5 -top-1.5 flex size-8 items-center justify-center rounded-full bg-(--as-primary) font-black text-(--as-on-primary)">{i + 1}</b>
              </span>
              <span className="sh-display as-2xl mt-3">{item.title}</span>
              {item.text ? <span className="as-sm as-muted max-w-72">{item.text}</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 6. packs (tied to the product's offers) ---------- */

/** Picks the offer in the order form, then goes to it. */
function chooseOffer(id: number, mode: string) {
  if (mode === "builder") return;
  window.dispatchEvent(new CustomEvent(CHOOSE_OFFER_EVENT, { detail: id }));
  scrollToOrder("live");
}

export function Bundles({ props }: { props: BundlesProps }) {
  const { data, mode } = usePage();
  const image = useImages();
  const productImages = useProductImages();
  const price = data.product?.price ?? 0;
  const offers = activeOffers(data.offers);
  const [chosen, setChosen] = React.useState<number | null>(null);

  React.useEffect(() => {
    const on = (e: Event) => setChosen(Number((e as CustomEvent<number>).detail));
    window.addEventListener(CHOOSE_OFFER_EVENT, on);
    return () => window.removeEventListener(CHOOSE_OFFER_EVENT, on);
  }, []);

  // The merchant's cards, or one per running offer (and the single piece first).
  const cards = props.cards.length
    ? props.cards.map((card) => ({ card, deal: card.offer_id === null ? dealOf(null, price) : (() => { const o = offers.find((x) => x.id === card.offer_id); return o ? dealOf(o, price) : null; })() }))
    : [null, ...offers].map((offer) => ({ card: null, deal: dealOf(offer, price) }));
  const shown = cards.filter((c) => c.deal !== null || mode === "builder");
  if (!data.product || (shown.length === 0 && mode === "live")) return null;
  const best = shown.reduce<number>((at, c, i) => (c.deal && c.deal.total < c.deal.was && (at < 0 || (shown[at].deal?.quantity ?? 0) < c.deal.quantity) ? i : at), -1);
  const highlighted = props.cards.length ? shown.findIndex((c) => c.card?.ribbon) : best;

  return (
    <section className="sh-cream sh-section">
      <div className="sh-wrap">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        {shown.length === 0 ? (
          <p className="as-sm as-muted mx-auto mt-8 max-w-md rounded-2xl border border-dashed p-6 text-center">{t.bundles.builderEmpty}</p>
        ) : (
          <ul className={cn("as-scroll -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-4 pt-4 @3xl:mx-0 @3xl:grid @3xl:overflow-visible @3xl:px-0", shown.length >= 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
            {shown.map(({ card, deal }, i) => {
              const top = i === highlighted;
              const id = deal?.offer?.id ?? 0;
              const selected = chosen === id;
              const save = deal && deal.was > deal.total ? Math.round(((deal.was - deal.total) / deal.was) * 100) : 0;
              const ribbon = card ? card.ribbon : top && save ? t.bundles.best : null;
              const photo = (card ? image(card.image_media_id) : null) ?? productImages[i % Math.max(1, productImages.length)] ?? null;
              return (
                <li key={i} className={cn("sh-card relative flex w-[80%] shrink-0 flex-col p-5 @3xl:w-auto", top && "border-2 border-(--as-primary) shadow-[0_30px_60px_-30px_color-mix(in_srgb,var(--as-primary)_70%,transparent)] @3xl:-translate-y-3", top && "order-first @3xl:order-none")}>
                  {ribbon ? <span className="as-xs absolute -top-3.5 start-5 rounded-full bg-(--as-primary) px-3 py-1 font-extrabold text-(--as-on-primary)">{ribbon}</span> : null}
                  <Photo urls={photo} size="medium" className="h-36 w-full rounded-2xl" />
                  <span className="sh-display as-2xl mt-4">{card ? card.title : deal?.offer ? deal.offer.name : t.bundles.piece}</span>
                  {card?.subtitle || deal?.offer ? <span className="as-sm font-bold as-muted">{card?.subtitle ?? (deal ? t.bundles.pieces(deal.quantity) : null)}</span> : null}
                  {card?.points.length ? (
                    <ul className="as-sm my-3 flex flex-col gap-1.5">
                      {card.points.map((point, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="h-3" />
                  )}
                  {deal ? (
                    <span className="mt-auto flex flex-wrap items-baseline gap-2">
                      <b className="as-2xl font-black">{formatMoney(deal.total)}</b>
                      {deal.was > deal.total ? <s className="as-sm font-bold as-muted">{formatMoney(deal.was)}</s> : null}
                      {save ? <span className="as-xs rounded-md bg-green-100 px-2 py-0.5 font-extrabold text-green-800">{t.bundles.saveOff(save)}</span> : null}
                    </span>
                  ) : (
                    <span className="as-xs mt-auto font-semibold text-red-600">{t.bundles.builderMissing}</span>
                  )}
                  <button type="button" disabled={!deal} onClick={() => (setChosen(id), chooseOffer(id, mode))} className={cn("as-base mt-4 h-12 w-full", top || selected ? "as-btn sh-btn-fire" : "sh-btn-ghost")}>
                    {selected ? <Check className="size-4" aria-hidden /> : null}
                    {selected ? t.bundles.chosen : t.bundles.choose}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- 7. gallery ---------- */

export function Gallery({ props }: { props: GalleryProps }) {
  const image = useImages();
  const productImages = useProductImages();
  const picked = props.image_media_ids.map((id) => image(id)).filter((u) => u !== null);
  const images = (picked.length ? picked : productImages).slice(0, 7);
  if (images.length === 0) return null;
  const shape = ["@3xl:col-span-2 @3xl:row-span-2", "", "", "col-span-2", "", "", "col-span-2"];
  return (
    <section className="sh-section">
      <div className="sh-wrap">
        <Head title={props.title} />
        <ul className="mt-10 grid auto-rows-[9.5rem] grid-cols-2 gap-3 @3xl:auto-rows-[13rem] @3xl:grid-cols-4">
          {images.map((urls, i) => (
            <li key={i} className={cn("overflow-hidden rounded-[1.4rem]", images.length > 2 && shape[i])}>
              <Photo urls={urls} alt={t.gallery.image(i + 1)} className="size-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 8. video ---------- */

export function Video({ props }: { props: VideoProps }) {
  const { mode } = usePage();
  const cover = imageSrc(useImage(props.cover_media_id), "large") ?? youtubePoster(props.url);
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  return (
    <section className="sh-dark sh-section">
      <div className="sh-wrap">
        <Head title={props.title} text={props.subtitle} />
        <div className="relative mt-9 aspect-[4/3] overflow-hidden rounded-[1.6rem] bg-black @3xl:aspect-[16/7] @3xl:rounded-[2rem]">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} aria-label={t.video.play} className="group relative block size-full">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- store media or the video's own poster
                <img src={cover} alt="" className="size-full object-cover brightness-75" />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-20 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary) shadow-[0_0_0_16px_color-mix(in_srgb,var(--as-primary)_25%,transparent)] transition group-hover:scale-105 @3xl:size-26">
                  <Play className="size-8 fill-current" aria-hidden />
                </span>
              </span>
              {props.caption ? <span className="as-lg absolute bottom-5 start-6 font-extrabold text-white">{props.caption}</span> : null}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 9. comparison ---------- */

export function Compare({ props }: { props: CompareProps }) {
  return (
    <section className="sh-section">
      <div className="sh-wrap">
        <Head title={props.title} />
        <div className="sh-card mt-10 overflow-hidden">
          <table className="as-sm w-full border-collapse @3xl:as-base">
            <thead>
              <tr className="sh-cream">
                <th className="w-[38%] p-3 @3xl:p-5" />
                <th className="bg-(--as-primary) p-3 font-extrabold text-(--as-on-primary) @3xl:p-5">{props.us}</th>
                <th className="p-3 font-extrabold @3xl:p-5">{props.them}</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3 font-bold @3xl:px-6 @3xl:py-4">{row.label}</td>
                  <td className="bg-(--as-soft) p-3 text-center font-extrabold as-primary @3xl:py-4">{row.us}</td>
                  <td className="p-3 text-center as-muted @3xl:py-4">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- 10. reviews ---------- */

export function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data, mode } = usePage();
  const image = useImages();
  const auto = props.source === "auto";
  const items = auto ? data.reviews.map((r) => ({ ...r, place: null, image_media_id: null })) : props.items;
  if (items.length === 0) {
    if (mode === "live") return null;
    return (
      <section className="sh-cream sh-section">
        <div className="sh-wrap">
          <Head kicker={props.kicker} title={props.title} />
          <p className="as-sm as-muted mx-auto mt-8 max-w-md rounded-2xl border border-dashed p-6 text-center">{t.testimonials.builderEmpty}</p>
        </div>
      </section>
    );
  }
  const average = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
  return (
    <section className="sh-cream sh-section">
      <div className="sh-wrap">
        <div className="flex flex-col items-start justify-between gap-6 @3xl:flex-row @3xl:items-end">
          <Head kicker={props.kicker} title={props.title} center={false} />
          {props.show_score ? (
            <div className="sh-card flex items-center gap-4 px-5 py-4">
              <b className="as-3xl font-black leading-none">{Math.round(average * 10) / 10}</b>
              <span className="flex flex-col gap-1">
                <Stars value={average} />
                <small className="as-xs font-bold as-muted">{t.testimonials.score(items.length)}</small>
              </span>
            </div>
          ) : null}
        </div>
        <ul className="as-scroll -mx-4 mt-9 flex snap-x gap-4 overflow-x-auto px-4 pb-2 @3xl:mx-0 @3xl:grid @3xl:grid-cols-3 @3xl:overflow-visible @3xl:px-0">
          {items.map((item, i) => {
            const photo = image(item.image_media_id);
            return (
              <li key={i} className="sh-card flex w-[84%] shrink-0 flex-col gap-2 p-5 @3xl:w-auto">
                {photo ? <Photo urls={photo} size="medium" className="mb-2 h-40 w-full rounded-2xl" /> : null}
                <Stars value={item.rating} />
                <p className="as-sm leading-relaxed">{item.text}</p>
                <p className="as-sm mt-auto flex items-center gap-2.5 pt-2 font-extrabold">
                  <span className="flex size-9 items-center justify-center rounded-full bg-(--as-secondary) text-(--as-on-secondary)" aria-hidden>
                    {item.name.trim().charAt(0)}
                  </span>
                  <span className="flex flex-col leading-tight">
                    {item.name}
                    <small className="as-xs font-semibold as-muted">
                      {item.place}
                      {auto ? (
                        <span className="font-extrabold text-green-700">
                          <Check className="me-0.5 inline size-3" aria-hidden />
                          {t.testimonials.verified}
                        </span>
                      ) : null}
                    </small>
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 11. countdown + units left ---------- */

export function Urgency({ props }: { props: UrgencyProps }) {
  const { data, mode } = usePage();
  const now = useNow(mode !== "builder");
  const left = props.ends_at ? timeLeft(props.ends_at, now) : null;
  const product = data.product;
  const stock = props.show_stock && product?.stock_mode === "product" && product.stock !== null && product.stock > 0 ? product.stock : null;
  const live = (left && !left.ended) || stock !== null;
  if (!live && mode === "live") return null;
  return (
    <section className="sh-wrap py-6">
      <div className="grid items-center gap-6 rounded-[2rem] bg-[linear-gradient(120deg,var(--as-primary),color-mix(in_srgb,var(--as-primary)_70%,var(--as-secondary)))] p-6 text-(--as-on-primary) @3xl:grid-cols-[1.2fr_1fr] @3xl:p-10">
        <div className="flex flex-col gap-2">
          <h2 className="sh-display sh-title">{props.title}</h2>
          {props.text ? <p className="as-base font-bold opacity-90">{props.text}</p> : null}
          {stock !== null ? (
            <>
              <p className="as-base font-extrabold">{t.urgency.left(stock)}</p>
              <div className="sh-bar mt-1">
                <div style={{ width: `${Math.min(92, Math.max(12, 100 - stock))}%` }} />
              </div>
            </>
          ) : null}
          {!live ? <p className="as-xs rounded-lg bg-black/20 p-2 font-bold">{t.urgency.builderHint}</p> : null}
        </div>
        {left && !left.ended ? (
          <div className="flex justify-center gap-2.5 @3xl:justify-end" dir="ltr" role="timer" aria-live="off">
            {[...left.parts].reverse().map((part) => (
              <span key={part.label} className="flex w-[4.4rem] flex-col items-center rounded-2xl bg-black/20 py-3 @3xl:w-22">
                <b className="as-3xl font-black leading-none tabular-nums">{pad(part.value)}</b>
                <small className="as-xs font-bold opacity-85" dir="rtl">
                  {part.label}
                </small>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- 12. guarantee ---------- */

export function Guarantee({ props }: { props: GuaranteeProps }) {
  return (
    <section className="sh-wrap py-8">
      <div className="flex flex-col items-center gap-5 rounded-[1.8rem] border-2 border-dashed border-(--as-secondary) bg-(--as-bg) p-6 text-center @3xl:flex-row @3xl:p-8 @3xl:text-start">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-(--as-soft) as-primary">
          <Icon name={props.icon} className="size-9" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="sh-display as-2xl">{props.title}</span>
          {props.text ? <span className="as-base as-muted">{props.text}</span> : null}
        </span>
      </div>
    </section>
  );
}

/* ---------- 13. questions (one open at a time) ---------- */

export function Faq({ props }: { props: FaqProps }) {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section className="sh-cream sh-section">
      <div className="sh-wrap max-w-[54rem]">
        <Head title={props.title} />
        <ul className="mt-8">
          {props.items.map((item, i) => {
            const on = open === i;
            return (
              <li key={i} className="sh-qa border-b py-4" data-open={on ? "" : undefined}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)} className="as-lg flex w-full items-center justify-between gap-4 text-start font-extrabold">
                  {item.question}
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border transition", on && "border-(--as-text) bg-(--as-text) text-(--as-bg)")} aria-hidden>
                    {on ? <X className="size-4" /> : <Plus className="size-4" />}
                  </span>
                </button>
                <div className="sh-qa-body">
                  <div>
                    <p className="as-base as-muted pt-2.5">{item.answer}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
