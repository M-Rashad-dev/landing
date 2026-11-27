"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, ImageOff, Play, Quote, Star } from "lucide-react";
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
import { RAWAQ_LANDING_ICONS } from "./icons";
import type {
  BeforeAfterProps,
  BenefitsProps,
  BundlesProps,
  CountdownProps,
  FaqProps,
  GalleryProps,
  HeroProps,
  HowToProps,
  IngredientsProps,
  PromisesProps,
  RawaqIcon,
  StatsProps,
  SuitsProps,
  TestimonialsProps,
  TrustProps,
  VideoProps,
} from "./types";

const t = ar.rawaqLanding;

/** The soft colors a card takes when the merchant didn't pick one (in turn). */
const SOFT = ["var(--rl-blush)", "var(--rl-mint)", "var(--rl-sand)", "color-mix(in srgb, var(--as-primary) 7%, var(--rl-mint))"];

/* ---------- shared pieces ---------- */

export function Photo({ urls, size = "large", alt = "", className }: { urls: MediaUrls | null; size?: "thumb" | "medium" | "large"; alt?: string; className?: string }) {
  const src = imageSrc(urls, size);
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-(--rl-blush) as-muted", className)}>
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

export function Icon({ name, className }: { name: RawaqIcon; className?: string }) {
  const Glyph = RAWAQ_LANDING_ICONS[name] ?? Star;
  return <Glyph className={className} aria-hidden />;
}

function Head({ kicker, title, text, center = true }: { kicker?: string | null; title?: string | null; text?: string | null; center?: boolean }) {
  if (!kicker && !title && !text) return null;
  return (
    <div className={cn("flex flex-col gap-2", center && "items-center text-center")}>
      {kicker ? <span className="rl-kicker">{kicker}</span> : null}
      {title ? <h2 className="rl-display rl-title">{title}</h2> : null}
      {text ? <p className="as-base as-muted max-w-2xl">{text}</p> : null}
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

/** What the Builder shows for a section with nothing to show yet (nothing on the live page). */
function Empty({ text }: { text: string }) {
  const { mode } = usePage();
  if (mode === "live") return null;
  return <p className="as-sm mx-auto max-w-md rounded-2xl border-2 border-dashed p-6 text-center as-muted">{text}</p>;
}

/** The average of the product's visible reviews, or null. */
function useRating(): number | null {
  const { data } = usePage();
  return data.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : null;
}

/* ---------- 1. the opening ---------- */

export function Hero({ props, nextId }: { props: HeroProps; nextId: string | null }) {
  const { mode, data } = usePage();
  const own = useImage(props.image_media_id);
  const fallback = useProductImages()[0] ?? null;
  const price = usePrice();
  const rating = useRating();
  const parts = props.highlight && props.title.includes(props.highlight) ? props.title.split(props.highlight) : null;
  const off = price?.was ? Math.round(((price.was - price.now) / price.was) * 100) : null;
  const goNext = () => mode !== "builder" && nextId && document.getElementById(`section-${nextId}`)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="rl-hero">
      <div className="rl-wrap grid items-center gap-8 pb-12 pt-8 @3xl:grid-cols-[1.05fr_1fr] @3xl:gap-12 @3xl:py-16">
        <div className="flex flex-col gap-4">
          {props.kicker ? <span className="rl-kicker">{props.kicker}</span> : null}
          <h1 className="rl-display rl-hero-title">
            {parts ? (
              <>
                {parts[0]}
                <em className="not-italic text-(--as-primary)">{props.highlight}</em>
                {parts.slice(1).join(props.highlight ?? "")}
              </>
            ) : (
              props.title
            )}
          </h1>
          {props.subtitle ? <p className="as-lg as-muted max-w-xl">{props.subtitle}</p> : null}
          {props.show_price && price ? (
            <p className="flex flex-wrap items-baseline gap-3">
              <b className="rl-display as-3xl leading-none text-(--as-primary)">{formatMoney(price.now)}</b>
              {price.was ? <s className="as-lg as-muted">{formatMoney(price.was)}</s> : null}
              {off ? <span className="as-xs rounded-full bg-(--as-primary) px-3 py-1 font-extrabold text-(--as-on-primary)">{t.off(off)}</span> : null}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 @xl:flex-row">
            <button type="button" onClick={() => scrollToOrder(mode)} className="rl-btn rl-btn-main as-base h-13">
              {props.button_label}
            </button>
            {props.second_label && nextId ? (
              <button type="button" onClick={goNext} className="rl-btn rl-btn-line as-base h-13">
                {props.second_label}
              </button>
            ) : null}
          </div>
          {props.chips.length ? (
            <ul className="as-xs flex flex-wrap gap-2 pt-1">
              {props.chips.map((chip, i) => (
                <li key={i} className="rl-chip">
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="rl-stage order-first mx-auto w-full max-w-[17rem] @3xl:order-none @3xl:max-w-md">
          <span className="rl-disk -start-4 bottom-2 size-36 bg-(--rl-mint)" aria-hidden />
          <span className="rl-disk -end-2 top-0 size-24 bg-(--rl-blush)" aria-hidden />
          <div className="rl-photo">
            <Photo urls={own ?? fallback} alt={data.product?.name ?? props.title} className="size-full" />
          </div>
          {props.show_rating && rating !== null ? (
            <span className="rl-rating as-xs start-2 top-6 flex flex-col gap-0.5 font-bold">
              <Stars value={rating} className="[&_svg]:size-3" />
              {t.ratingLine(Math.round(rating * 10) / 10, data.reviews.length)}
            </span>
          ) : null}
          {props.badge ? <span className="rl-badge rl-display as-xl bottom-6 end-0">{props.badge}</span> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. the trust strip ---------- */

export function Trust({ props }: { props: TrustProps }) {
  return (
    <section className="border-b bg-(--rl-white)">
      <ul className={cn("rl-wrap grid grid-cols-2 gap-x-3 gap-y-5 py-6", props.items.length >= 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "")}>
        {props.items.map((item, i) => (
          <li key={i} className={cn("flex items-center gap-3", props.items.length === 3 && i === 2 && "col-span-2 justify-center @3xl:col-span-1 @3xl:justify-start")}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--rl-blush) text-(--as-primary)">
              <Icon name={item.icon} className="size-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <b className="as-sm">{item.title}</b>
              {item.text ? <span className="as-xs as-muted">{item.text}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 3. what it helps with ---------- */

export function Benefits({ props }: { props: BenefitsProps }) {
  return (
    <section className="rl-section">
      <div className="rl-wrap flex flex-col gap-9">
        <Head kicker={props.kicker} title={props.title} />
        <ul className={cn("rl-reveal grid grid-cols-2 gap-3 @3xl:gap-4", props.items.length % 3 === 0 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-4")}>
          {props.items.map((item, i) => (
            <li key={i} className="rl-benefit flex flex-col gap-3 p-5 @3xl:p-6" style={{ background: item.color ?? SOFT[i % SOFT.length] }}>
              <span className="flex size-12 items-center justify-center rounded-full bg-white/80 text-(--as-primary)">
                <Icon name={item.icon} className="size-6" />
              </span>
              <b className="rl-display as-xl">{item.title}</b>
              {item.text ? <span className="as-sm as-muted relative z-1">{item.text}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 4. before / after ---------- */

export function BeforeAfter({ props }: { props: BeforeAfterProps }) {
  const image = useImages();
  const before = image(props.before_media_id);
  const after = image(props.after_media_id);
  // How much of «قبل» shows, from the start (right) side, in %.
  const [shown, setShown] = React.useState(50);
  if (!before || !after) {
    return (
      <section className="rl-section">
        <div className="rl-wrap">
          <Empty text={t.beforeAfter.empty} />
        </div>
      </section>
    );
  }
  return (
    <section className="rl-section rl-sand">
      <div className="rl-wrap rl-reveal grid items-center gap-8 @3xl:grid-cols-[1fr_1.25fr]">
        <div className="flex flex-col gap-4">
          <Head kicker={props.kicker} title={props.title} text={props.text} center={false} />
          {props.facts.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 pt-2">
              {props.facts.map((fact, i) => (
                <li key={i} className="rl-card flex flex-col gap-1 p-4 text-center">
                  <b className="rl-display as-2xl text-(--as-primary)" dir="ltr">
                    {fact.value}
                  </b>
                  <span className="as-xs as-muted">{fact.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative aspect-[4/5] select-none overflow-hidden rounded-[2rem] @3xl:aspect-[5/4]">
          <Photo urls={after} alt={props.after_label} className="absolute inset-0 size-full" />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${100 - shown}%)` }}>
            <Photo urls={before} alt={props.before_label} className="absolute inset-0 size-full" />
          </div>
          <span className="as-xs absolute start-4 top-4 rounded-full bg-white/90 px-3 py-1 font-extrabold text-black">{props.before_label}</span>
          <span className="as-xs absolute end-4 top-4 rounded-full bg-(--as-primary) px-3 py-1 font-extrabold text-(--as-on-primary)">{props.after_label}</span>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ right: `${shown}%` }}>
            <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
              <ChevronRight className="-me-1 size-4" />
              <ChevronLeft className="-ms-1 size-4" />
            </span>
          </span>
          <input type="range" dir="rtl" min={0} max={100} value={shown} onChange={(e) => setShown(Number(e.target.value))} aria-label={t.beforeAfter.drag} className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. what's inside ---------- */

export function Ingredients({ props }: { props: IngredientsProps }) {
  return (
    <section className="rl-section">
      <div className="rl-wrap flex flex-col gap-9">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        <ul className={cn("rl-reveal grid grid-cols-2 gap-3 @3xl:gap-4", props.items.length === 3 ? "@3xl:grid-cols-3" : props.items.length >= 5 ? "@3xl:grid-cols-4 @5xl:grid-cols-5" : "@3xl:grid-cols-4", props.items.length === 3 && "[&>li:last-child]:col-span-2 @3xl:[&>li:last-child]:col-span-1")}>
          {props.items.map((item, i) => (
            <li key={i} className="rl-card flex flex-col items-center gap-2 p-5 text-center">
              <span className="rl-symbol rl-display as-lg" style={{ background: item.color ?? SOFT[i % SOFT.length] }} dir="ltr">
                {item.symbol}
              </span>
              <b className="as-base">{item.name}</b>
              {item.text ? <span className="as-xs as-muted">{item.text}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 6. how to use it ---------- */

export function HowTo({ props }: { props: HowToProps }) {
  const own = useImage(props.image_media_id);
  const productImages = useProductImages();
  const photo = own ?? productImages[1] ?? productImages[0] ?? null;
  return (
    <section className="rl-section rl-blush">
      <div className={cn("rl-wrap rl-reveal grid items-center gap-10", photo && "@3xl:grid-cols-[1fr_1.15fr] @3xl:gap-14")}>
        {photo ? <Photo urls={photo} alt={props.title ?? ""} className="aspect-[4/5] w-full rounded-[2rem] @3xl:aspect-square" /> : null}
        <div className="flex flex-col gap-7">
          <Head kicker={props.kicker} title={props.title} center={!photo} />
          <ol className="rl-steps flex flex-col gap-5">
            {props.steps.map((step, i) => (
              <li key={i} className="relative flex gap-4">
                <span className="rl-step-no as-base" aria-label={t.howTo.step(i + 1)}>
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1 pt-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="as-lg">{step.title}</b>
                    {step.time ? (
                      <span className="rl-time as-xs">
                        <Clock className="size-3" aria-hidden />
                        {step.time}
                      </span>
                    ) : null}
                  </div>
                  {step.text ? <p className="as-sm as-muted">{step.text}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          {props.note ? <p className="as-sm rl-card px-4 py-3 font-semibold">{props.note}</p> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 7. who it suits ---------- */

export function Suits({ props }: { props: SuitsProps }) {
  return (
    <section className="rl-wrap py-8 @3xl:py-10">
      <div className="rl-reveal flex flex-col items-center gap-4 text-center">
        <h2 className="rl-display as-2xl">{props.title}</h2>
        <ul className="as-sm flex flex-wrap justify-center gap-2.5">
          {props.items.map((item, i) => (
            <li key={i} className="rl-suit">
              <Check className="size-4 text-(--as-secondary)" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        {props.note ? <p className="as-sm as-muted max-w-xl">{props.note}</p> : null}
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
    <section className="rl-section">
      <div className="rl-wrap">
        <Head kicker={props.kicker} title={props.title} text={props.subtitle} />
        {shown.length === 0 ? (
          <div className="mt-8">
            <Empty text={t.bundles.builderEmpty} />
          </div>
        ) : (
          <ul className={cn("rl-reveal as-scroll -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-4 pt-4 @3xl:mx-0 @3xl:grid @3xl:gap-5 @3xl:overflow-visible @3xl:px-0", shown.length >= 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
            {shown.map(({ card, deal }, i) => {
              const top = i === highlighted;
              const id = deal?.offer?.id ?? 0;
              const selected = chosen === id;
              const save = deal && deal.was > deal.total ? Math.round(((deal.was - deal.total) / deal.was) * 100) : 0;
              const ribbon = card ? card.ribbon : top && save ? t.bundles.best : null;
              const photo = (card ? image(card.image_media_id) : null) ?? productImages[i % Math.max(1, productImages.length)] ?? null;
              return (
                <li key={i} data-top={top ? "" : undefined} data-chosen={selected ? "" : undefined} className={cn("rl-bundle w-[80%] shrink-0 snap-start p-5 @3xl:w-auto", top && "order-first @3xl:order-none")}>
                  {ribbon ? <span className="as-xs absolute -top-3 start-6 rounded-full bg-(--as-primary) px-3.5 py-1 font-extrabold text-(--as-on-primary)">{ribbon}</span> : null}
                  <div className="aspect-[4/3] overflow-hidden rounded-[1.2rem] bg-(--rl-blush)">
                    <Photo urls={photo} size="medium" className="size-full" />
                  </div>
                  <span className="rl-display as-2xl mt-4">{card ? card.title : deal?.offer ? deal.offer.name : t.bundles.piece}</span>
                  {card?.subtitle || deal?.offer ? <span className="as-sm as-muted">{card?.subtitle ?? (deal ? t.bundles.pieces(deal.quantity) : null)}</span> : null}
                  {card?.points.length ? (
                    <ul className="as-sm my-4 flex flex-col gap-2">
                      {card.points.map((point, j) => (
                        <li key={j} className="flex items-center gap-2">
                          <Check className="size-4 shrink-0 text-(--as-secondary)" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="h-4" />
                  )}
                  {deal ? (
                    <span className="mt-auto flex flex-wrap items-baseline gap-2 border-t pt-4">
                      <b className="rl-display as-2xl text-(--as-primary)">{formatMoney(deal.total)}</b>
                      {deal.was > deal.total ? <s className="as-sm as-muted">{formatMoney(deal.was)}</s> : null}
                      {save ? <span className="as-xs ms-auto font-extrabold text-(--as-secondary)">{t.bundles.saveOff(save)}</span> : null}
                    </span>
                  ) : (
                    <span className="as-xs mt-auto font-semibold text-red-600">{t.bundles.builderMissing}</span>
                  )}
                  <button type="button" disabled={!deal} onClick={() => (setChosen(id), chooseOffer(id, mode))} className={cn("rl-btn as-base mt-4 h-12 w-full", top || selected ? "rl-btn-main" : "rl-btn-line")}>
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
    <section className="rl-wrap py-8 @3xl:py-12">
      <div className="rl-reveal flex flex-col gap-8 rounded-[2rem] bg-(--rl-sand) px-5 py-9 @3xl:px-10">
        <Head kicker={props.kicker} title={props.title} />
        <dl className={cn("grid grid-cols-2 gap-y-7", props.items.length === 3 ? "@3xl:grid-cols-3" : props.items.length === 2 ? "@3xl:grid-cols-2" : "@3xl:grid-cols-4")}>
          {props.items.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 text-center">
              <dd className="rl-display text-(--as-primary)" style={{ fontSize: "calc(var(--as-fs) * 2.5rem)", lineHeight: 1.1 }} dir="ltr">
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

/* ---------- 10. pictures ---------- */

export function Gallery({ props }: { props: GalleryProps }) {
  const image = useImages();
  const productImages = useProductImages();
  const picked = props.image_media_ids.map((id) => image(id)).filter((u) => u !== null);
  const images = (picked.length ? picked : productImages).slice(0, 8);
  if (images.length === 0) return null;
  return (
    <section className="rl-section">
      <div className="rl-wrap flex flex-col gap-9">
        <Head kicker={props.kicker} title={props.title} />
        <ul className={cn("rl-reveal grid grid-cols-2 gap-3 @3xl:gap-4", images.length >= 4 ? "@3xl:grid-cols-4" : images.length === 3 ? "@3xl:grid-cols-3" : "")}>
          {images.map((urls, i) => (
            <li key={i} className={cn("rl-zoom aspect-square rounded-[1.4rem]", images.length % 2 === 1 && i === 0 && "col-span-2 aspect-[2/1] @3xl:col-span-1 @3xl:aspect-square")}>
              <Photo urls={urls} alt={t.gallery.image(i + 1)} className="size-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 11. video ---------- */

export function Video({ props }: { props: VideoProps }) {
  const { mode } = usePage();
  const cover = imageSrc(useImage(props.cover_media_id), "large") ?? youtubePoster(props.url);
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  return (
    <section className="rl-section">
      <div className="rl-wrap flex flex-col gap-8">
        <Head title={props.title} text={props.subtitle} />
        <div className="rl-reveal relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[2rem] bg-black shadow-[0_40px_70px_-40px_rgb(90_30_50/0.6)]">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} aria-label={t.video.play} className="group relative block size-full">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- store media or the video's own poster
                <img src={cover} alt="" className="size-full object-cover brightness-90 transition duration-700 group-hover:scale-[1.03]" />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-20 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary) shadow-xl transition group-hover:scale-105">
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

/* ---------- 12. reviews ---------- */

export function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data } = usePage();
  const image = useImages();
  const auto = props.source === "auto";
  const items = auto ? data.reviews.map((r) => ({ ...r, place: null, image_media_id: null })) : props.items;
  if (items.length === 0) {
    return (
      <section className="rl-section">
        <div className="rl-wrap flex flex-col gap-8">
          <Head kicker={props.kicker} title={props.title} />
          <Empty text={t.testimonials.builderEmpty} />
        </div>
      </section>
    );
  }
  const average = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
  return (
    <section className="rl-section">
      <div className="rl-wrap flex flex-col gap-8">
        <Head kicker={props.kicker} title={props.title} />
        {props.show_score ? (
          <div className="-mt-3 flex items-center justify-center gap-3">
            <b className="rl-display as-3xl leading-none text-(--as-primary)">{Math.round(average * 10) / 10}</b>
            <span className="flex flex-col gap-0.5">
              <Stars value={average} />
              <small className="as-xs as-muted font-semibold">{t.testimonials.score(items.length)}</small>
            </span>
          </div>
        ) : null}
        <ul className="rl-reveal as-scroll -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 @3xl:mx-0 @3xl:grid @3xl:grid-cols-3 @3xl:gap-5 @3xl:overflow-visible @3xl:px-0">
          {items.map((item, i) => {
            const photo = image(item.image_media_id);
            return (
              <li key={i} className="rl-card flex w-[84%] shrink-0 snap-start flex-col gap-3 p-6 @3xl:w-auto">
                <div className="flex items-center justify-between">
                  <Stars value={item.rating} />
                  <Quote className="size-6 text-(--as-primary)/35" aria-hidden />
                </div>
                <p className="as-base leading-relaxed">{item.text}</p>
                {photo ? <Photo urls={photo} size="medium" className="h-40 w-full rounded-xl" /> : null}
                <div className="mt-auto flex items-center gap-3 border-t pt-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--rl-blush) font-extrabold text-(--as-primary)">{item.name.slice(0, 1)}</span>
                  <span className="as-sm flex flex-col font-bold leading-tight">
                    {item.name}
                    <small className="as-xs as-muted font-semibold">
                      {item.place}
                      {auto ? (
                        <span className="text-(--as-secondary)">
                          <Check className="me-0.5 inline size-3" aria-hidden />
                          {t.testimonials.verified}
                        </span>
                      ) : null}
                    </small>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 13. countdown + units left ---------- */

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
    <section className="rl-wrap py-8 @3xl:py-12">
      <div className="rl-dark rl-reveal grid items-center gap-7 rounded-[2rem] p-7 @3xl:grid-cols-[1.1fr_1fr] @3xl:p-11">
        <div className="flex flex-col gap-3">
          {props.kicker ? <span className="rl-kicker">{props.kicker}</span> : null}
          <h2 className="rl-display rl-title">{props.title}</h2>
          {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
          {stock !== null ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="as-sm font-bold">{t.countdown.left(stock)}</p>
              <div className="rl-bar">
                <div style={{ width: `${Math.min(92, Math.max(10, 100 - stock))}%` }} />
              </div>
            </div>
          ) : null}
          {!live ? <p className="as-xs rounded-lg border border-dashed p-2 font-semibold">{t.countdown.builderHint}</p> : null}
        </div>
        {left && !left.ended ? (
          <div className="flex justify-center gap-2.5 @3xl:justify-end" dir="ltr" role="timer" aria-live="off">
            {[...parts].reverse().map((part) => (
              <span key={part.label} className="rl-digit flex w-[4.4rem] flex-col items-center py-3.5 @3xl:w-22 @3xl:py-4">
                <b className="rl-display tabular-nums" style={{ fontSize: "calc(var(--as-fs) * 2.2rem)", lineHeight: 1 }}>
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

/* ---------- 14. promises (delivery, payment, exchange…) ---------- */

export function Promises({ props }: { props: PromisesProps }) {
  return (
    <section className="rl-wrap py-8 @3xl:py-10">
      <ul className={cn("rl-reveal grid gap-3 @md:grid-cols-2", props.items.length >= 4 ? "@3xl:grid-cols-4" : props.items.length === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
        {props.items.map((item, i) => (
          <li key={i} className="rl-card flex items-center gap-4 p-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--rl-mint) text-(--as-secondary)">
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

/* ---------- 15. questions (one open at a time) ---------- */

export function Faq({ props }: { props: FaqProps }) {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section className="rl-section">
      <div className="rl-wrap flex max-w-[52rem] flex-col gap-8">
        <Head kicker={props.kicker} title={props.title} />
        <ul className="flex flex-col gap-3">
          {props.items.map((item, i) => {
            const on = open === i;
            return (
              <li key={i} className="rl-qa rl-card" data-open={on ? "" : undefined}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)} className="as-base flex w-full items-center justify-between gap-3 p-4 text-start font-bold">
                  {item.question}
                  <ChevronDown className={cn("size-5 shrink-0 transition", on && "rotate-180")} aria-hidden />
                </button>
                <div className="rl-qa-body">
                  <div>
                    <p className="as-sm as-muted whitespace-pre-line px-4 pb-4 leading-loose">{item.answer}</p>
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
