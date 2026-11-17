"use client";

import { Check, ImageOff, Play, Plus, Quote, Star } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { MediaUrls } from "@/themes/shared/design";
import { imageSrc, scrollToOrder, useImage, usePage, useProductImages } from "@/themes/landing/bidaya/context";
import { usePrice } from "@/themes/landing/bidaya/sections";
import { chooseOffer, highlightedCard, offerCards, useOfferChoice } from "@/themes/landing/shared/offers";
import { pad, timeLeft, useNow } from "@/themes/store/shared/use-countdown";
import { embedUrl, youtubePoster } from "@/themes/store/sufi/types";
import { SUFI_LANDING_ICONS } from "./icons";
import type {
  BundlesProps,
  CountdownProps,
  DetailsProps,
  FaqProps,
  FeaturesProps,
  GalleryProps,
  HeroProps,
  MarqueeProps,
  PromisesProps,
  SpecsProps,
  StatsProps,
  SufiIcon,
  TestimonialsProps,
  VideoProps,
} from "./types";

const t = ar.sufiLanding;

/* ---------- shared pieces ---------- */

export function Photo({ urls, size = "large", alt = "", className }: { urls: MediaUrls | null; size?: "thumb" | "medium" | "large"; alt?: string; className?: string }) {
  const src = imageSrc(urls, size);
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-(--sl-soft) as-muted", className)}>
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

export function Icon({ name, className }: { name: SufiIcon; className?: string }) {
  const Glyph = SUFI_LANDING_ICONS[name] ?? Star;
  return <Glyph className={className} strokeWidth={1.5} aria-hidden />;
}

export function Ornament({ className }: { className?: string }) {
  return (
    <span className={cn("sl-orn", className)} aria-hidden>
      <i />
      <b />
      <i />
    </span>
  );
}

function Head({ kicker, title, text, center = true }: { kicker?: string | null; title?: string | null; text?: string | null; center?: boolean }) {
  if (!kicker && !title && !text) return null;
  return (
    <div className={cn("flex flex-col gap-3", center ? "items-center text-center" : "sl-start items-start")}>
      {kicker ? <span className="sl-kicker">{kicker}</span> : null}
      {title ? <h2 className="sl-display sl-title">{title}</h2> : null}
      {center && title ? <Ornament className="mt-1" /> : null}
      {text ? <p className="as-lg as-muted max-w-2xl">{text}</p> : null}
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(value) ? "fill-(--as-primary) text-(--as-primary)" : "text-(--as-line)")} aria-hidden />
      ))}
    </span>
  );
}

/** The title with the merchant's word in the main color. */
function Highlighted({ title, word }: { title: string; word: string | null }) {
  const parts = word && title.includes(word) ? title.split(word) : null;
  if (!parts) return <>{title}</>;
  return (
    <>
      {parts[0]}
      <em className="not-italic text-(--as-primary)">{word}</em>
      {parts.slice(1).join(word ?? "")}
    </>
  );
}

/* ---------- 1. hero (split or cover) ---------- */

export function Hero({ props, nextId }: { props: HeroProps; nextId: string | null }) {
  const { mode, data } = usePage();
  const own = useImage(props.image_media_id);
  const fallback = useProductImages()[0] ?? null;
  const price = usePrice();
  const rating = data.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : null;
  const off = price?.was ? Math.round(((price.was - price.now) / price.was) * 100) : null;
  const cover = props.layout === "cover";
  const goNext = () => mode !== "builder" && nextId && document.getElementById(`section-${nextId}`)?.scrollIntoView({ behavior: "smooth" });

  const text = (
    <div className={cn("flex flex-col gap-5", cover && "max-w-2xl")}>
      {props.kicker ? <span className={cn("sl-kicker", cover && "text-white")}>{props.kicker}</span> : null}
      <h1 className="sl-display sl-hero-title">
        <Highlighted title={props.title} word={props.highlight} />
      </h1>
      {props.subtitle ? <p className={cn("as-lg max-w-xl", cover ? "text-white/85" : "as-muted")}>{props.subtitle}</p> : null}
      {props.show_rating && rating !== null ? (
        <p className={cn("as-sm flex items-center gap-2 font-bold", cover ? "text-white/85" : "as-muted")}>
          <Stars value={rating} />
          {t.ratingLine(Math.round(rating * 10) / 10, data.reviews.length)}
        </p>
      ) : null}
      {props.show_price && price ? (
        <p className="flex flex-wrap items-baseline gap-3">
          <b className="as-3xl font-extrabold leading-none">{formatMoney(price.now)}</b>
          {price.was ? <s className={cn("as-lg", cover ? "text-white/70" : "as-muted")}>{formatMoney(price.was)}</s> : null}
          {off ? <span className="sl-pill as-xs border-(--as-primary) text-(--as-primary)">{t.off(off)}</span> : null}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 @xl:flex-row">
        <button type="button" onClick={() => scrollToOrder(mode)} className="sl-btn sl-btn-gold as-base h-14">
          {props.button_label}
        </button>
        {props.second_label && nextId ? (
          <button type="button" onClick={goNext} className={cn("sl-btn as-base h-14", cover ? "sl-btn-glass" : "sl-btn-line")}>
            {props.second_label}
          </button>
        ) : null}
      </div>
      {props.badges.length ? (
        <ul className="flex flex-wrap gap-2">
          {props.badges.map((badge, i) => (
            <li key={i} className={cn("sl-pill", cover && "border-white/50 text-white")}>
              <Check className="size-3.5 text-(--as-primary)" aria-hidden />
              {badge}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  if (cover) {
    const src = imageSrc(own ?? fallback, "large");
    return (
      <section className="sl-cover flex items-end">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
          <img src={src} alt={props.title} className="sl-cover-img" />
        ) : null}
        <span className="sl-cover-shade" aria-hidden />
        <div className="sl-wrap relative pb-12 pt-28 @3xl:pb-20">{text}</div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div className="sl-wrap grid items-center gap-12 pb-16 pt-10 @3xl:grid-cols-[1.05fr_1fr] @3xl:gap-16 @3xl:pb-24 @3xl:pt-16">
        {text}
        <div className="sl-arch order-first mx-auto w-[86%] max-w-[30rem] @3xl:order-none">
          <Photo urls={own ?? fallback} alt={props.title} className="sl-arch-img aspect-[4/5] w-full" />
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. marquee ---------- */

export function Marquee({ props }: { props: MarqueeProps }) {
  const items = [...props.items, ...props.items, ...props.items];
  return (
    <div className="sl-marquee as-sm py-3.5 font-bold tracking-wide">
      <div className="sl-marquee-track">
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
  );
}

/* ---------- 3. why you'll love it ---------- */

export function Features({ props }: { props: FeaturesProps }) {
  return (
    <section className="sl-section">
      <div className="sl-wrap sl-reveal">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        <ul className={cn("mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-(--sl-radius) border bg-(--as-line)", props.items.length % 3 === 0 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-4")}>
          {props.items.map((item, i) => (
            <li key={i} className={cn("flex flex-col items-center gap-2.5 bg-(--as-bg) px-3 py-6 text-center @3xl:gap-3 @3xl:p-9", props.items.length % 2 === 1 && i === props.items.length - 1 && "col-span-2 @3xl:col-span-1")}>
              <span className="flex size-13 items-center justify-center rounded-full border border-(--sl-gold) text-(--as-primary) @3xl:size-16">
                <Icon name={item.icon} className="size-6 @3xl:size-7" />
              </span>
              <h3 className="sl-display as-lg @3xl:as-xl">{item.title}</h3>
              {item.text ? <p className="as-sm as-muted">{item.text}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 4. up close: one row per detail, picture and text in turn ---------- */

export function Details({ props }: { props: DetailsProps }) {
  const image = useImages();
  const productImages = useProductImages();
  return (
    <section className="sl-section sl-band">
      <div className="sl-wrap">
        <Head kicker={props.kicker} title={props.title} />
        <ol className="mt-12 flex flex-col gap-14 @3xl:gap-20">
          {props.rows.map((row, i) => (
            <li key={i} className="sl-reveal grid items-center gap-8 @3xl:grid-cols-2 @3xl:gap-16">
              <div className={cn("sl-zoom overflow-hidden rounded-(--sl-radius)", i % 2 === 1 && "@3xl:order-last")}>
                <Photo urls={image(row.image_media_id) ?? productImages[(i + 1) % Math.max(1, productImages.length)] ?? null} alt={row.title} className="aspect-[5/4] w-full" />
              </div>
              <div className="flex flex-col gap-4">
                <span className="sl-num" aria-hidden>
                  {pad(i + 1)}
                </span>
                <h3 className="sl-display as-3xl">{row.title}</h3>
                {row.text ? <p className="as-base as-muted leading-loose">{row.text}</p> : null}
                {row.points.length ? (
                  <ul className="as-sm mt-1 flex flex-col gap-2.5 font-semibold">
                    {row.points.map((point, j) => (
                      <li key={j} className="flex items-center gap-3">
                        <span className="size-1.5 rotate-45 bg-(--as-primary)" aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 5. specifications ---------- */

export function Specs({ props }: { props: SpecsProps }) {
  const own = useImage(props.image_media_id);
  return (
    <section className="sl-section">
      <div className={cn("sl-wrap sl-reveal grid items-center gap-10", own && "@3xl:grid-cols-[1fr_1.2fr] @3xl:gap-16")}>
        {own ? <Photo urls={own} alt={props.title ?? ""} className="aspect-square w-full rounded-(--sl-radius)" /> : null}
        <div className={cn("flex flex-col gap-6", !own && "mx-auto w-full max-w-3xl")}>
          <Head kicker={props.kicker} title={props.title} center={!own} />
          <dl>
            {props.rows.map((row, i) => (
              <div key={i} className="sl-spec as-base">
                <dt className="as-muted shrink-0">{row.label}</dt>
                <span className="sl-dots" aria-hidden />
                <dd className="text-end font-bold">{row.value}</dd>
              </div>
            ))}
          </dl>
          {props.note ? <p className="as-sm as-muted">{props.note}</p> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 6. gallery ---------- */

export function Gallery({ props }: { props: GalleryProps }) {
  const image = useImages();
  const productImages = useProductImages();
  const picked = props.image_media_ids.map((id) => image(id)).filter((u) => u !== null);
  const images = (picked.length ? picked : productImages).slice(0, 9);
  if (images.length === 0) return null;
  // A big first picture (2 × 2) when there are enough; the last one widens to close its row.
  const big = images.length >= 3;
  const cells = (big ? 4 : 1) + images.length - 1;
  const fill = (columns: number) => (cells % columns === 0 ? 1 : columns - (cells % columns) + 1);
  const style = { "--sl-fill-sm": fill(2), "--sl-fill-lg": fill(4) } as React.CSSProperties;
  return (
    <section className="sl-section">
      <div className="sl-wrap">
        <Head kicker={props.kicker} title={props.title} />
        <ul className="sl-reveal mt-12 grid auto-rows-[10rem] grid-cols-2 gap-3 @3xl:auto-rows-[13rem] @3xl:grid-cols-4 @3xl:gap-4" style={style}>
          {images.map((urls, i) => (
            <li key={i} className={cn("sl-zoom rounded-(--sl-radius)", big && i === 0 && "col-span-2 row-span-2", i === images.length - 1 && i > 0 && "col-span-(--sl-fill-sm) @3xl:col-span-(--sl-fill-lg)")}>
              <Photo urls={urls} alt={t.gallery.image(i + 1)} className="size-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 7. video ---------- */

export function Video({ props }: { props: VideoProps }) {
  const { mode } = usePage();
  const cover = imageSrc(useImage(props.cover_media_id), "large") ?? youtubePoster(props.url);
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  return (
    <section className="sl-section sl-band">
      <div className="sl-wrap">
        <Head title={props.title} text={props.subtitle} />
        <div className="sl-reveal relative mt-10 aspect-[4/3] overflow-hidden rounded-(--sl-radius) bg-black ring-1 ring-(--sl-gold) ring-offset-8 ring-offset-(--sl-surface) @3xl:aspect-video">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} aria-label={t.video.play} className="group relative block size-full">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- store media or the video's own poster
                <img src={cover} alt="" className="size-full object-cover brightness-75 transition duration-700 group-hover:scale-[1.03]" />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-20 items-center justify-center rounded-full border border-white/70 bg-white/10 text-white backdrop-blur transition group-hover:bg-(--as-primary) group-hover:text-(--as-on-primary) @3xl:size-24">
                  <Play className="size-7 fill-current" aria-hidden />
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. offers (tied to the product's offers) ---------- */

export function Bundles({ props }: { props: BundlesProps }) {
  const { data, mode } = usePage();
  const image = useImages();
  const productImages = useProductImages();
  const [chosen, setChosen] = React.useState<number | null>(null);
  useOfferChoice(setChosen);

  const shown = offerCards(props.cards, data.offers, data.product?.price ?? 0).filter((c) => c.deal !== null || mode === "builder");
  if (!data.product || (shown.length === 0 && mode === "live")) return null;
  const highlighted = highlightedCard(shown, props.cards.length > 0);

  return (
    <section className="sl-section">
      <div className="sl-wrap">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        {shown.length === 0 ? (
          <p className="as-sm as-muted mx-auto mt-8 max-w-md rounded-(--sl-radius) border border-dashed p-6 text-center">{t.bundles.builderEmpty}</p>
        ) : (
          <ul className={cn("sl-reveal as-scroll -mx-4 mt-12 flex snap-x gap-4 overflow-x-auto px-4 pb-4 pt-4 @3xl:mx-0 @3xl:grid @3xl:gap-6 @3xl:overflow-visible @3xl:px-0", shown.length >= 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
            {shown.map(({ card, deal }, i) => {
              const top = i === highlighted;
              const id = deal?.offer?.id ?? 0;
              const selected = chosen === id;
              const save = deal && deal.was > deal.total ? Math.round(((deal.was - deal.total) / deal.was) * 100) : 0;
              const ribbon = card ? card.ribbon : top && save ? t.bundles.best : null;
              const photo = (card ? image(card.image_media_id) : null) ?? productImages[i % Math.max(1, productImages.length)] ?? null;
              return (
                <li key={i} className={cn("relative flex w-[80%] shrink-0 snap-start flex-col rounded-(--sl-radius) border p-6 @3xl:w-auto", top ? "sl-ink border-transparent shadow-[0_40px_70px_-40px_rgb(0_0_0/0.6)] @3xl:-translate-y-3" : "bg-(--sl-surface)", top && "order-first @3xl:order-none", selected && !top && "border-(--as-primary)")}>
                  {ribbon ? <span className="as-xs absolute -top-3 start-6 rounded-full bg-(--as-primary) px-3.5 py-1 font-extrabold text-(--as-on-primary)">{ribbon}</span> : null}
                  <Photo urls={photo} size="medium" className="aspect-[4/3] w-full rounded-[calc(var(--sl-radius)-0.4rem)]" />
                  <span className="sl-display as-2xl mt-5">{card ? card.title : deal?.offer ? deal.offer.name : t.bundles.piece}</span>
                  {card?.subtitle || deal?.offer ? <span className="as-sm as-muted">{card?.subtitle ?? (deal ? t.bundles.pieces(deal.quantity) : null)}</span> : null}
                  {card?.points.length ? (
                    <ul className="as-sm my-4 flex flex-col gap-2">
                      {card.points.map((point, j) => (
                        <li key={j} className="flex items-center gap-2.5">
                          <span className="size-1.5 shrink-0 rotate-45 bg-(--as-primary)" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="h-4" />
                  )}
                  {deal ? (
                    <span className="mt-auto flex flex-wrap items-baseline gap-2 border-t pt-4">
                      <b className="as-2xl font-extrabold">{formatMoney(deal.total)}</b>
                      {deal.was > deal.total ? <s className="as-sm as-muted">{formatMoney(deal.was)}</s> : null}
                      {save ? <span className="as-xs ms-auto font-bold text-(--as-primary)">{t.bundles.saveOff(save)}</span> : null}
                    </span>
                  ) : (
                    <span className="as-xs mt-auto font-semibold text-red-600">{t.bundles.builderMissing}</span>
                  )}
                  <button type="button" disabled={!deal} onClick={() => (setChosen(id), chooseOffer(id, mode))} className={cn("sl-btn as-base mt-5 h-12 w-full", top || selected ? "sl-btn-gold" : "sl-btn-line")}>
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

/* ---------- 9. numbers ---------- */

export function Stats({ props }: { props: StatsProps }) {
  return (
    <section className="sl-band py-12 @3xl:py-16">
      <div className="sl-wrap sl-reveal flex flex-col gap-10">
        <Head kicker={props.kicker} title={props.title} />
        <dl className={cn("grid grid-cols-2 gap-y-8", props.items.length === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-4", props.items.length === 2 && "@3xl:grid-cols-2")}>
          {props.items.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 border-(--as-line) text-center @3xl:border-s @3xl:first:border-s-0">
              <dd className="sl-display text-(--as-primary)" style={{ fontSize: "calc(var(--as-fs) * 2.6rem)", lineHeight: 1.1 }}>
                {item.value}
              </dd>
              <dt className="as-sm as-muted font-semibold">{item.label}</dt>
            </div>
          ))}
        </dl>
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
      <section className="sl-section">
        <div className="sl-wrap">
          <Head kicker={props.kicker} title={props.title} />
          <p className="as-sm as-muted mx-auto mt-8 max-w-md rounded-(--sl-radius) border border-dashed p-6 text-center">{t.testimonials.builderEmpty}</p>
        </div>
      </section>
    );
  }
  const average = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
  return (
    <section className="sl-section">
      <div className="sl-wrap">
        <Head kicker={props.kicker} title={props.title} />
        {props.show_score ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <b className="sl-display as-3xl leading-none">{Math.round(average * 10) / 10}</b>
            <span className="flex flex-col gap-0.5">
              <Stars value={average} />
              <small className="as-xs as-muted font-semibold">{t.testimonials.score(items.length)}</small>
            </span>
          </div>
        ) : null}
        <ul className="sl-reveal as-scroll -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-2 @3xl:mx-0 @3xl:grid @3xl:grid-cols-3 @3xl:gap-6 @3xl:overflow-visible @3xl:px-0">
          {items.map((item, i) => {
            const photo = image(item.image_media_id);
            return (
              <li key={i} className="sl-card flex w-[84%] shrink-0 snap-start flex-col gap-3 p-6 @3xl:w-auto">
                <Quote className="size-7 text-(--sl-gold)" aria-hidden />
                <p className="as-base leading-relaxed">{item.text}</p>
                {photo ? <Photo urls={photo} size="medium" className="h-40 w-full rounded-xl" /> : null}
                <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                  <span className="as-sm flex flex-col font-bold leading-tight">
                    {item.name}
                    <small className="as-xs as-muted font-semibold">
                      {item.place}
                      {auto ? (
                        <span className="text-(--as-primary)">
                          <Check className="me-0.5 inline size-3" aria-hidden />
                          {t.testimonials.verified}
                        </span>
                      ) : null}
                    </small>
                  </span>
                  <Stars value={item.rating} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 11. countdown + units left ---------- */

export function Countdown({ props }: { props: CountdownProps }) {
  const { data, mode } = usePage();
  const now = useNow(mode !== "builder");
  const left = props.ends_at ? timeLeft(props.ends_at, now) : null;
  const product = data.product;
  const stock = props.show_stock && product?.stock_mode === "product" && product.stock !== null && product.stock > 0 ? product.stock : null;
  const live = (left && !left.ended) || stock !== null;
  if (!live && mode === "live") return null;
  const parts = left ? [{ value: left.seconds, label: t.units.seconds }, { value: left.minutes, label: t.units.minutes }, { value: left.hours, label: t.units.hours }, ...(left.days > 0 ? [{ value: left.days, label: t.units.days }] : [])] : [];
  return (
    <section className="sl-wrap py-8 @3xl:py-12">
      <div className="sl-ink sl-reveal grid items-center gap-8 rounded-(--sl-radius) p-7 @3xl:grid-cols-[1.1fr_1fr] @3xl:p-12">
        <div className="flex flex-col gap-3">
          {props.kicker ? <span className="sl-kicker">{props.kicker}</span> : null}
          <h2 className="sl-display sl-title">{props.title}</h2>
          {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
          {stock !== null ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="as-sm font-bold text-(--as-primary)">{t.countdown.left(stock)}</p>
              <div className="sl-bar">
                <div style={{ width: `${Math.min(92, Math.max(10, 100 - stock))}%` }} />
              </div>
            </div>
          ) : null}
          {!live ? <p className="as-xs rounded-lg border border-dashed p-2 font-semibold">{t.countdown.builderHint}</p> : null}
        </div>
        {left && !left.ended ? (
          <div className="flex justify-center gap-2.5 @3xl:justify-end" dir="ltr" role="timer" aria-live="off">
            {[...parts].reverse().map((part) => (
              <span key={part.label} className="sl-digit flex w-[4.6rem] flex-col items-center py-3.5 @3xl:w-24 @3xl:py-5">
                <b className="sl-display text-(--as-primary) tabular-nums" style={{ fontSize: "calc(var(--as-fs) * 2.3rem)", lineHeight: 1 }}>
                  {pad(part.value)}
                </b>
                <small className="as-xs as-muted mt-1 font-semibold" dir="rtl">
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

/* ---------- 12. promises (shipping, payment, returns…) ---------- */

export function Promises({ props }: { props: PromisesProps }) {
  return (
    <section className="sl-band py-10 @3xl:py-12">
      <ul className={cn("sl-wrap grid gap-6 @md:grid-cols-2", props.items.length >= 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
        {props.items.map((item, i) => (
          <li key={i} className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--sl-soft) text-(--as-primary)">
              <Icon name={item.icon} className="size-6" />
            </span>
            <span className="flex flex-col">
              <b className="as-base">{item.title}</b>
              {item.text ? <span className="as-sm as-muted">{item.text}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 13. questions (one open at a time) ---------- */

export function Faq({ props }: { props: FaqProps }) {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section className="sl-section">
      <div className="sl-wrap max-w-[52rem]">
        <Head kicker={props.kicker} title={props.title} />
        <ul className="mt-10 border-t">
          {props.items.map((item, i) => {
            const on = open === i;
            return (
              <li key={i} className="sl-qa border-b py-5" data-open={on ? "" : undefined}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)} className="as-lg flex w-full items-center justify-between gap-4 text-start font-bold">
                  {item.question}
                  <span className="sl-qa-icon flex size-9 shrink-0 items-center justify-center rounded-full border" aria-hidden>
                    <Plus className="size-4" />
                  </span>
                </button>
                <div className="sl-qa-body">
                  <div>
                    <p className="as-base as-muted pt-3 leading-loose">{item.answer}</p>
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
