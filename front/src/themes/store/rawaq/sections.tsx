"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, ImageOff, Play, Plus, RotateCcw, Star, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { addToCart } from "@/lib/store/cart";
import { sendQuizResult, sendStoreEvent } from "@/lib/store/events";
import { track } from "@/lib/tracking/track";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { StoreAiSection } from "@/themes/store/shared/ai-section";
import { whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink } from "@/themes/store/shared/context";
import { useShop } from "@/themes/store/shared/shop";
import type { ProductCard } from "@/themes/store/shared/types";
import { pad, timeLeft, useNow } from "@/themes/store/shared/use-countdown";
import { FEATURE_ICONS } from "../asas/icons";
import type { FeaturesProps, ProductsProps, TestimonialsProps } from "../asas/types";
import { embedUrl, youtubePoster, type BannersProps, type BrandsProps, type CategoriesProps, type CountdownProps, type FaqProps, type TabsProps, type VideoProps } from "../sufi/types";
import { RawaqCard } from "./card";
import { useRawaq } from "./root";
import type { Article, ArticlesProps, BeforeAfterProps, CtaProps, GlowHeroProps, IngredientsProps, RawaqSection, ReelsProps, RoutineProps, ShortcutsProps, SkinQuizProps } from "./types";

const t = ar.rawaqStore;

/** The soft colors a tile or card takes when the merchant didn't pick one (in turn). */
const SOFT = ["var(--rq-blush)", "var(--rq-sand)", "var(--rq-mint)", "color-mix(in srgb, var(--as-primary) 7%, var(--rq-mint))"];

/* ---------- shared pieces ---------- */

/** Picked images by id: the Builder's new picks first, else the design data. */
function useImage(): (id: number | null | undefined) => MediaUrls | null {
  const { media, data } = useRawaq();
  return (id) => (id ? (media[String(id)] ?? data.media[String(id)] ?? null) : null);
}

function Photo({ urls, size = "large", alt = "", className }: { urls: MediaUrls | null; size?: "thumb" | "medium" | "large"; alt?: string; className?: string }) {
  const src = pick(urls, size);
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-(--rq-blush) as-muted", className)}>
        <ImageOff className="size-8" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}

function Head({ kicker, title, text, end }: { kicker?: string | null; title?: string | null; text?: string | null; end?: React.ReactNode }) {
  if (!kicker && !title && !text && !end) return null;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {kicker ? <span className="rq-kicker">{kicker}</span> : null}
        {title ? <h2 className="rq-display rq-title">{title}</h2> : null}
        {text ? <p className="as-base as-muted max-w-2xl">{text}</p> : null}
      </div>
      {end}
    </div>
  );
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-(--as-line)")} aria-hidden />
      ))}
    </span>
  );
}

/** What the Builder shows for a section with nothing to show yet (nothing on the live store). */
function Empty({ text }: { text: string }) {
  const { mode } = useRawaq();
  if (mode !== "builder") return null;
  return <p className="as-sm rounded-2xl border-2 border-dashed p-6 text-center as-muted">{text}</p>;
}

function Grid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @3xl:gap-5 @5xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <RawaqCard product={p} index={i} />
        </li>
      ))}
    </ul>
  );
}

type AddAll = "idle" | "added" | "choose" | "gone";

/** Puts every product in the cart in one go (a routine, a quiz result); `missing` when some can't be shown any more. */
function addAllToCart(products: ProductCard[], missing: boolean): AddAll {
  if (missing || products.some((p) => !p.available)) return "gone";
  if (products.some((p) => p.needs_options)) return "choose";
  for (const product of products) {
    addToCart({ product_id: product.id, quantity: 1, options: {}, ...(product.digital ? { digital: true } : {}), name: product.name, slug: product.slug, image: pick(product.image?.urls, "thumb"), price: product.price, options_label: "", max: product.max_quantity ?? null });
  }
  sendStoreEvent("add_to_cart");
  track("AddToCart", { content_ids: products.map((p) => p.id), value: products.reduce((sum, p) => sum + p.price, 0), num_items: products.length });
  return "added";
}

/* ---------- 1. the opening ---------- */

function GlowHero({ id, props }: { id: string; props: GlowHeroProps }) {
  const { data } = useRawaq();
  const image = useImage()(props.media_id);
  const parts = props.highlight && props.title.includes(props.highlight) ? props.title.split(props.highlight) : null;
  return (
    <section className="rq-hero">
      <div className="rq-wrap grid items-center gap-8 pb-12 pt-8 @3xl:grid-cols-[1.05fr_1fr] @3xl:gap-12 @3xl:py-16">
        <div className="flex flex-col gap-4">
          {props.kicker ? <span className="rq-kicker">{props.kicker}</span> : null}
          <h1 className="rq-display rq-hero-title">
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
          <div className="flex flex-wrap gap-3">
            <StoreLink href={data.links[`${id}:primary`] ?? null} className="rq-btn rq-btn-main as-base h-13 px-8">
              {props.primary_label}
            </StoreLink>
            {props.second_label ? (
              <StoreLink href={data.links[`${id}:second`] ?? null} className="rq-btn rq-btn-line as-base h-13 px-8">
                {props.second_label}
              </StoreLink>
            ) : null}
          </div>
          {props.chips.length ? (
            <ul className="as-xs flex flex-wrap gap-2 pt-1">
              {props.chips.map((chip, i) => (
                <li key={i} className="rq-chip">
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="rq-stage order-first mx-auto w-full max-w-[17rem] @3xl:order-none @3xl:max-w-md">
          <span className="rq-stage-disk -start-4 bottom-2 size-36 bg-(--rq-mint)" aria-hidden />
          <span className="rq-stage-disk -end-2 top-0 size-24 bg-(--rq-blush)" aria-hidden />
          <div className="rq-stage-photo">
            <Photo urls={image} alt={props.title} className="size-full" />
          </div>
          {props.rating ? (
            <span className="rq-rating as-xs start-2 top-6 flex flex-col gap-0.5 font-bold">
              <Stars value={5} className="[&_svg]:size-3" />
              {props.rating}
            </span>
          ) : null}
          {props.badge ? <span className="rq-badge rq-display as-xl bottom-6 end-0">{props.badge}</span> : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. the trust strip ---------- */

function Trust({ props }: { props: FeaturesProps }) {
  return (
    <section className="border-y border-(--as-line) bg-(--rq-white)">
      <div className="rq-wrap py-5">
        {props.title ? <h2 className="rq-display as-xl mb-4 text-center">{props.title}</h2> : null}
        <ul className={cn("grid grid-cols-2 gap-4", props.items.length >= 4 ? "@3xl:grid-cols-4" : "@3xl:grid-cols-3")}>
          {props.items.map((item, i) => {
            const Icon = FEATURE_ICONS[item.icon] ?? Star;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--rq-blush) text-(--as-primary)">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <b className="as-sm">{item.title}</b>
                  {item.text ? <span className="as-xs as-muted">{item.text}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 3. shortcuts: skin types, concerns… ---------- */

function Shortcuts({ id, props }: { id: string; props: ShortcutsProps }) {
  const { data } = useRawaq();
  const image = useImage();
  const circles = props.style === "circles";
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head kicker={props.kicker} title={props.title} text={props.description} />
        {props.items.length === 0 ? (
          <Empty text={t.empty.shortcuts} />
        ) : circles ? (
          <ul className="grid grid-cols-3 gap-4 @3xl:grid-cols-6">
            {props.items.map((item, i) => {
              const urls = image(item.media_id);
              return (
                <li key={i}>
                  <StoreLink href={data.links[`${id}:${i}`] ?? null} className="flex flex-col items-center gap-2 text-center">
                    <span className="rq-tile w-full" style={{ background: item.color ?? SOFT[i % SOFT.length] }}>
                      {urls ? <Photo urls={urls} size="medium" alt={item.label} className="size-full" /> : <span className="rq-drop" aria-hidden />}
                    </span>
                    <b className="as-base">{item.label}</b>
                    {item.text ? <span className="as-xs as-muted -mt-1.5">{item.text}</span> : null}
                  </StoreLink>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-4">
            {props.items.map((item, i) => {
              const urls = image(item.media_id);
              return (
                <li key={i}>
                  <StoreLink href={data.links[`${id}:${i}`] ?? null} className="rq-concern flex h-full flex-col justify-between gap-4 p-4 @3xl:p-6" style={{ background: item.color ?? SOFT[i % SOFT.length] }}>
                    <span className="relative z-1 flex flex-col gap-1.5">
                      {urls ? <Photo urls={urls} size="thumb" alt="" className="mb-1 size-12 rounded-full" /> : null}
                      <b className="rq-display as-xl">{item.label}</b>
                      {item.text ? <span className="as-xs as-muted">{item.text}</span> : null}
                    </span>
                    <span className="as-sm relative z-1 font-extrabold">{ar.storefront.viewAll} ←</span>
                  </StoreLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- 4. categories ---------- */

function Categories({ id, props }: { id: string; props: CategoriesProps }) {
  const { data } = useRawaq();
  const tiles = data.category_tiles?.[id] ?? [];
  const cols = { "--cols": props.columns_mobile, "--cols-wide": props.columns_desktop } as React.CSSProperties;
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head title={props.title} text={props.description} />
        {tiles.length ? (
          <ul className={cn(props.layout === "slider" ? "flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]" : "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-4 @3xl:grid-cols-[repeat(var(--cols-wide),minmax(0,1fr))]")} style={cols}>
            {tiles.map((c, i) => (
              <li key={c.id} className={props.layout === "slider" ? "w-28 shrink-0 @3xl:w-36" : undefined}>
                <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="flex flex-col items-center gap-2 text-center">
                  <span className={cn("rq-tile w-full", props.shape !== "circle" && "!rounded-[1.4rem]")} style={{ background: SOFT[i % SOFT.length] }}>
                    <Photo urls={c.image?.urls ?? null} size="medium" alt={c.name} className="size-full" />
                  </span>
                  <b className="as-base">{c.name}</b>
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

/* ---------- 5. products with tabs, and a product list ---------- */

function ProductTabs({ id, props }: { id: string; props: TabsProps }) {
  const { data } = useRawaq();
  const [tab, setTab] = React.useState(0);
  const current = Math.min(tab, props.tabs.length - 1);
  const products = data.products[`${id}:${current}`] ?? [];
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head
          title={props.title}
          text={props.description}
          end={
            props.tabs.length > 1 ? (
              <div className="rq-tabs" role="tablist">
                {props.tabs.map((x, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === current} onClick={() => setTab(i)} className="rq-tab as-sm">
                    {x.label}
                  </button>
                ))}
              </div>
            ) : null
          }
        />
        {products.length ? <Grid products={products} /> : <Empty text={t.empty.products} />}
      </div>
    </section>
  );
}

function Products({ id, props }: { id: string; props: ProductsProps }) {
  const { data } = useRawaq();
  const products = data.products[id] ?? [];
  const all = props.show_view_all ? (data.view_all[id] ?? null) : null;
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head
          title={props.title}
          text={props.description}
          end={
            all ? (
              <StoreLink href={all} className="as-sm border-b-2 border-(--as-primary) font-extrabold text-(--as-primary)">
                {t.viewAll}
              </StoreLink>
            ) : null
          }
        />
        {products.length === 0 ? (
          <Empty text={t.empty.products} />
        ) : props.layout === "slider" ? (
          <ul className="rq-slider">
            {products.map((p, i) => (
              <li key={p.id}>
                <RawaqCard product={p} index={i} />
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

/* ---------- 6. a routine: 2–4 products added together ---------- */

function Routine({ id, props }: { id: string; props: RoutineProps }) {
  const { data, mode } = useRawaq();
  const shop = useShop();
  const products = data.products[id] ?? [];
  const [state, setState] = React.useState<AddAll>("idle");
  // The steps whose product can still be bought, in the merchant's order.
  const steps = props.steps.map((step) => ({ step, product: products.find((p) => p.id === step.product_id) ?? null })).filter((x) => x.product !== null) as Array<{ step: RoutineProps["steps"][number]; product: ProductCard }>;
  if (steps.length === 0) return <Empty text={t.empty.routine} />;
  const now = steps.reduce((sum, x) => sum + x.product.price, 0);
  const was = steps.reduce((sum, x) => sum + Math.max(x.product.price, x.product.compare_at_price ?? 0), 0);

  const addAll = () => {
    if (mode !== "live" || !shop) return;
    setState(addAllToCart(steps.map((x) => x.product), steps.length < props.steps.length));
  };

  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap">
        <div className="rq-routine grid items-center gap-8 p-6 @3xl:grid-cols-[1fr_1.5fr] @3xl:p-11">
          <div className="flex flex-col gap-3">
            {props.kicker ? <span className="rq-kicker">{props.kicker}</span> : null}
            <h2 className="rq-display rq-title">{props.title}</h2>
            {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
            <p className="flex flex-wrap items-baseline gap-3 pt-2">
              <b className="rq-display as-3xl text-(--as-primary)">{formatMoney(now)}</b>
              {was > now ? <s className="as-sm as-muted">{formatMoney(was)}</s> : null}
              {was > now ? <span className="as-xs rounded-full bg-(--as-primary) px-3 py-1 font-extrabold text-(--as-on-primary)">{t.routine.save(was - now)}</span> : null}
            </p>
            <button type="button" onClick={addAll} className="rq-btn rq-btn-main as-base mt-2 h-13 w-fit px-8" aria-live="polite">
              {state === "added" ? <Check className="size-5" aria-hidden /> : null}
              {state === "added" ? t.routine.added : props.button_label || t.routine.add}
            </button>
            {state === "choose" || state === "gone" ? (
              <p className="as-xs font-semibold text-red-600" role="alert">
                {state === "choose" ? t.routine.choose : t.routine.gone}
              </p>
            ) : null}
          </div>
          <ol className="flex items-stretch gap-2 overflow-x-auto pb-1 @3xl:gap-3">
            {steps.map(({ step, product }, i) => (
              <React.Fragment key={product.id}>
                {i > 0 ? (
                  <li aria-hidden className="flex items-center text-(--as-primary)">
                    <Plus className="size-5" />
                  </li>
                ) : null}
                <li className="min-w-28 flex-1">
                  <StoreLink href={`/products/${encodeURIComponent(product.slug)}`} className="rq-card flex h-full flex-col items-center gap-2 p-3 text-center @3xl:p-4">
                    <span className="rq-step-no as-xs">{i + 1}</span>
                    <Photo urls={product.image?.urls ?? null} size="medium" alt={product.name} className="aspect-square w-full rounded-2xl bg-(--rq-blush) object-contain p-2" />
                    <b className="as-sm line-clamp-2">{step.label ?? product.name}</b>
                    {step.hint ? <span className="as-xs as-muted">{step.hint}</span> : null}
                    <span className="as-xs mt-auto font-bold text-(--as-primary)">{formatMoney(product.price)}</span>
                  </StoreLink>
                </li>
              </React.Fragment>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------- 7. banners ---------- */

function Banners({ id, props }: { id: string; props: BannersProps }) {
  const { data } = useRawaq();
  const image = useImage();
  if (!props.items.length) return <Empty text={t.empty.banners} />;
  return (
    <section className="rq-section rq-reveal">
      <ul className={cn("rq-wrap grid gap-4", props.items.length > 1 && "@3xl:grid-cols-2", props.items.length > 2 && "@5xl:grid-cols-3")}>
        {props.items.map((item, i) => (
          <li key={i} className="relative overflow-hidden rounded-[var(--rq-radius)]">
            <StoreLink href={data.links[`${id}:${i}`] ?? null} className="group block">
              <Photo urls={image(item.media_id)} alt={item.title ?? ""} className="aspect-[16/10] w-full transition duration-500 group-hover:scale-105" />
              {item.title || item.kicker || item.button_label ? (
                <span className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-linear-to-t from-black/60 to-transparent p-5 text-white">
                  {item.kicker ? <span className="as-xs font-bold opacity-90">{item.kicker}</span> : null}
                  {item.title ? <b className="rq-display as-2xl">{item.title}</b> : null}
                  {item.button_label ? <span className="as-sm mt-1 w-fit border-b-2 border-white font-bold">{item.button_label}</span> : null}
                </span>
              ) : null}
            </StoreLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 8. an offer with a countdown ---------- */

function Countdown({ id, props }: { id: string; props: CountdownProps }) {
  const { data, mode } = useRawaq();
  const image = useImage()(props.media_id);
  const left = timeLeft(props.ends_at, useNow(mode !== "builder"));
  if (left?.ended && props.on_end === "hide" && mode !== "builder") return null;
  const parts = left ? [left.days, left.hours, left.minutes, left.seconds] : null;
  const labels = [t.units.days, t.units.hours, t.units.minutes, t.units.seconds];
  return (
    <section className="rq-section">
      <div className="rq-wrap">
        <div className={cn("rq-dark grid items-center gap-8 overflow-hidden rounded-[2rem] p-6 @3xl:p-11", image && "@3xl:grid-cols-[1.2fr_1fr]")}>
          <div className="flex flex-col gap-4">
            {props.kicker ? <span className="rq-kicker">{props.kicker}</span> : null}
            <h2 className="rq-display rq-title">{props.title}</h2>
            {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
            {left?.ended ? (
              <p className="rq-display as-2xl">{t.ended}</p>
            ) : (
              <div className="flex gap-2.5" dir="ltr">
                {labels.map((label, i) => (
                  <span key={label} className="flex w-18 flex-col items-center rounded-2xl border border-(--as-line) bg-(--as-card) py-3">
                    <b className="rq-display as-2xl tabular-nums">{parts ? pad(parts[i]) : "--"}</b>
                    <span className="as-xs as-muted">{label}</span>
                  </span>
                ))}
              </div>
            )}
            {props.button_label && !left?.ended ? (
              <StoreLink href={data.links[id] ?? null} className="rq-btn as-base h-13 w-fit bg-white px-8 text-[#2b2226]">
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

/* ---------- 9. short videos ---------- */

function Player({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const embed = embedUrl(url);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/75" onClick={onClose} aria-label={t.video.close} />
      <div className="relative aspect-[9/16] h-[min(85vh,46rem)] max-w-full overflow-hidden rounded-2xl bg-black">
        {embed ? <iframe src={embed} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" /> : null}
        <button type="button" onClick={onClose} className="absolute end-3 top-3 flex size-10 items-center justify-center rounded-full bg-white/90 text-black" aria-label={t.video.close}>
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}

function Reels({ props }: { props: ReelsProps }) {
  const { mode } = useRawaq();
  const image = useImage();
  const [playing, setPlaying] = React.useState<number | null>(null);
  const close = React.useCallback(() => setPlaying(null), []);
  if (!props.items.length) return <Empty text={t.empty.reels} />;
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head kicker={props.kicker} title={props.title} />
        <ul className="rq-reels">
          {props.items.map((reel, i) => {
            const poster = pick(image(reel.cover_media_id), "medium") ?? youtubePoster(reel.url);
            return (
              <li key={i}>
                <button type="button" onClick={() => mode !== "builder" && setPlaying(i)} className="rq-reel group flex w-full flex-col justify-end p-3 text-start" aria-label={reel.title ?? t.video.play}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the merchant's cover or the video's own poster */}
                  {poster ? <img src={poster} alt="" className="absolute inset-0 size-full object-cover" /> : null}
                  <span className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" aria-hidden />
                  <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-white/90 text-(--as-primary) shadow-xl transition group-hover:scale-110">
                    <Play className="size-6 fill-current" aria-hidden />
                  </span>
                  {reel.title ? <b className="as-sm relative">{reel.title}</b> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {playing !== null && props.items[playing] ? <Player url={props.items[playing].url} title={props.items[playing].title ?? t.video.play} onClose={close} /> : null}
    </section>
  );
}

function Video({ props }: { props: VideoProps }) {
  const { mode } = useRawaq();
  const cover = useImage()(props.cover_media_id);
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  const poster = pick(cover, "large") ?? youtubePoster(props.url);
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head title={props.title} text={props.text} />
        <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[1.8rem] bg-black shadow-xl">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} className="group absolute inset-0" aria-label={t.video.play}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the merchant's cover or the video's own poster */}
              {poster ? <img src={poster} alt="" className="size-full object-cover opacity-90" /> : null}
              <span className="absolute inset-0 m-auto flex size-18 items-center justify-center rounded-full bg-white/90 text-(--as-primary) shadow-2xl transition group-hover:scale-110">
                <Play className="size-7 fill-current" aria-hidden />
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 10. ingredients ---------- */

function Ingredients({ id, props }: { id: string; props: IngredientsProps }) {
  const { data } = useRawaq();
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head kicker={props.kicker} title={props.title} text={props.description} />
        <ul className={cn("grid grid-cols-2 gap-3 @3xl:gap-4", props.items.length >= 5 ? "@3xl:grid-cols-5" : "@3xl:grid-cols-4")}>
          {props.items.map((item, i) => {
            const href = data.links[`${id}:${i}`] ?? null;
            const body = (
              <>
                <span className="rq-display as-lg mx-auto flex size-16 items-center justify-center rounded-full text-(--as-primary)" style={{ background: item.color ?? SOFT[i % SOFT.length] }} dir="ltr">
                  {item.symbol}
                </span>
                <b className="as-base">{item.name}</b>
                {item.text ? <span className="as-xs as-muted">{item.text}</span> : null}
              </>
            );
            return (
              <li key={i}>
                {href ? (
                  <StoreLink href={href} className="rq-card flex h-full flex-col gap-2 p-5 text-center transition hover:-translate-y-0.5">
                    {body}
                  </StoreLink>
                ) : (
                  <div className="rq-card flex h-full flex-col gap-2 p-5 text-center">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 11. brands ---------- */

function Brands({ id, props }: { id: string; props: BrandsProps }) {
  const { data } = useRawaq();
  const image = useImage();
  if (!props.items.length) return <Empty text={t.empty.brands} />;
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head title={props.title} />
        <ul className="grid grid-cols-3 gap-3 @3xl:grid-cols-6 @3xl:gap-4">
          {props.items.map((item, i) => (
            <li key={i}>
              <StoreLink href={data.links[`${id}:${i}`] ?? null} className="rq-card flex h-20 items-center justify-center p-3 grayscale transition hover:grayscale-0">
                <Photo urls={image(item.media_id)} size="thumb" alt={item.name ?? ""} className="max-h-full max-w-full object-contain" />
              </StoreLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 12. reviews ---------- */

function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data } = useRawaq();
  const items = props.source === "auto" ? data.reviews : props.items;
  if (!items.length) return null;
  const average = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
  const counts = [5, 4, 3, 2, 1].map((n) => items.filter((r) => r.rating === n).length);
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head title={props.title} />
        <div className="grid gap-5 @3xl:grid-cols-[18rem_1fr]">
          <div className="rq-card flex flex-col items-center gap-2 p-6 text-center">
            <b className="rq-display text-[3.2rem] leading-none text-(--as-primary)">{Math.round(average * 10) / 10}</b>
            <Stars value={average} />
            <span className="as-xs as-muted">{t.ratingLine(Math.round(average * 10) / 10, items.length)}</span>
            <ul className="mt-2 flex w-full flex-col gap-1.5">
              {counts.map((n, i) => (
                <li key={i} className="as-xs flex items-center gap-2">
                  <span className="w-3">{5 - i}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--as-line)">
                    <span className="block h-full bg-amber-400" style={{ width: `${(n / items.length) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-4 @3xl:grid-cols-3">
            {items.slice(0, 6).map((r, i) => (
              <li key={i} className="rq-card flex flex-col gap-3 p-5">
                <Stars value={r.rating} />
                <p className="as-sm leading-relaxed">{r.text}</p>
                <p className="as-sm mt-auto flex items-center gap-2 font-bold">
                  <span className="flex size-8 items-center justify-center rounded-full bg-(--rq-blush) text-(--as-primary)">{r.name.trim().charAt(0)}</span>
                  {r.name}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- 13. questions ---------- */

function Faq({ props }: { props: FaqProps }) {
  const { settings } = useRawaq();
  const [open, setOpen] = React.useState<number | null>(0);
  const wa = props.whatsapp_button && settings.footer.whatsapp ? whatsappLink(settings.footer.whatsapp) : null;
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap grid gap-8 @3xl:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-3">
          {props.title ? <h2 className="rq-display rq-title">{props.title}</h2> : null}
          {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="rq-btn rq-btn-ink as-sm mt-2 h-11 w-fit px-6">
              {t.faq.whatsapp}
            </a>
          ) : null}
        </div>
        <ul className="flex flex-col gap-3">
          {props.items.map((item, i) => (
            <li key={i} className="rq-qa rq-card" data-open={open === i ? "" : undefined}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="as-base flex w-full items-center justify-between gap-3 p-4 text-start font-bold" aria-expanded={open === i}>
                {item.question}
                <ChevronDown className={cn("size-5 shrink-0 transition", open === i && "rotate-180")} aria-hidden />
              </button>
              <div className="rq-qa-body">
                <div>
                  <p className="as-sm as-muted whitespace-pre-line px-4 pb-4">{item.answer}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 14. a WhatsApp (or link) band ---------- */

function Cta({ id, props }: { id: string; props: CtaProps }) {
  const { settings, data, mode } = useRawaq();
  const number = settings.footer.whatsapp;
  const href = props.action === "whatsapp" ? (number ? whatsappLink(number, props.message ?? undefined) : null) : (data.links[id] ?? null);
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap">
        <div className="flex flex-col items-start gap-5 rounded-[2rem] bg-(--as-primary) p-7 text-(--as-on-primary) @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:p-11">
          <div className="flex flex-col gap-2">
            <h2 className="rq-display rq-title">{props.title}</h2>
            {props.text ? <p className="as-base opacity-85">{props.text}</p> : null}
          </div>
          {href ? (
            props.action === "whatsapp" ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="rq-btn rq-btn-ink as-base h-13 shrink-0 px-8">
                {props.button_label}
              </a>
            ) : (
              <StoreLink href={href} className="rq-btn rq-btn-ink as-base h-13 shrink-0 px-8">
                {props.button_label}
              </StoreLink>
            )
          ) : mode === "builder" ? (
            <p className="as-sm max-w-xs rounded-xl bg-white/15 p-3">{t.empty.whatsapp}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 15. before / after ---------- */

function BeforeAfter({ props }: { props: BeforeAfterProps }) {
  const image = useImage();
  const before = image(props.before_media_id);
  const after = image(props.after_media_id);
  // How much of «قبل» shows, from the start (right) side, in %.
  const [shown, setShown] = React.useState(50);
  if (!before || !after) return <Empty text={t.empty.beforeAfter} />;
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap grid items-center gap-8 @3xl:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-4">
          <Head kicker={props.kicker} title={props.title} text={props.text} />
          {props.facts.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 pt-2">
              {props.facts.map((fact, i) => (
                <li key={i} className="rq-card flex flex-col gap-1 p-4 text-center">
                  <b className="rq-display as-2xl text-(--as-primary)" dir="ltr">
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
          <input
            type="range"
            dir="rtl"
            min={0}
            max={100}
            value={shown}
            onChange={(e) => setShown(Number(e.target.value))}
            aria-label={t.beforeAfter.drag}
            className="absolute inset-0 size-full cursor-ew-resize opacity-0"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- 16. the skin quiz ---------- */

/** The result with the most votes from the answers picked (a tie goes to the result listed first). */
export function quizResult(props: Pick<SkinQuizProps, "results" | "questions">, picked: number[]): number {
  const votes = new Map<string, number>();
  picked.forEach((answer, q) => {
    for (const id of props.questions[q]?.answers[answer]?.results ?? []) votes.set(id, (votes.get(id) ?? 0) + 1);
  });
  let best = 0;
  props.results.forEach((result, i) => {
    if ((votes.get(result.id) ?? 0) > (votes.get(props.results[best]!.id) ?? 0)) best = i;
  });
  return best;
}

const noSubscribe = () => () => undefined;

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function SkinQuiz({ id, props }: { id: string; props: SkinQuizProps }) {
  const { data, mode } = useRawaq();
  const shop = useShop();
  const memory = `rq_quiz_${id}`;
  // null: the start card; a number: the question showing; "done": the result.
  const [step, setStep] = React.useState<number | "done" | null>(null);
  const [picked, setPicked] = React.useState<number[]>([]);
  const [result, setResult] = React.useState(0);
  const [added, setAdded] = React.useState<AddAll>("idle");
  // The live store shows the visitor's last result straight away (kept in this browser only).
  const saved = React.useSyncExternalStore(noSubscribe, () => (mode === "live" ? readStored(memory) : null), () => null);
  const savedIndex = props.results.findIndex((r) => r.id === saved);
  const remembered = step === null && savedIndex >= 0;

  const choose = (answer: number) => {
    if (typeof step !== "number") return;
    const next = [...picked.slice(0, step), answer];
    setPicked(next);
    if (step + 1 < props.questions.length) return setStep(step + 1);
    const best = quizResult(props, next);
    setResult(best);
    setStep("done");
    setAdded("idle");
    const resultId = props.results[best]!.id;
    if (mode === "live") {
      sendQuizResult(id, resultId);
      try {
        window.localStorage.setItem(memory, resultId);
      } catch {
        // Not remembered: fine.
      }
    }
  };

  const restart = () => {
    setPicked([]);
    setAdded("idle");
    setStep(0);
  };

  const shown = remembered ? savedIndex : result;
  const current = props.results[shown];
  const products = data.products[`${id}:${shown}`] ?? [];
  const category = data.links[`${id}:${shown}`] ?? null;
  const question = typeof step === "number" ? props.questions[step] : null;

  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap">
        <div className="rq-routine flex flex-col gap-6 p-6 @3xl:p-11" aria-live="polite">
          {step === null && !remembered ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
              {props.kicker ? <span className="rq-kicker">{props.kicker}</span> : null}
              <h2 className="rq-display rq-title">{props.title}</h2>
              {props.text ? <p className="as-base as-muted">{props.text}</p> : null}
              <button type="button" onClick={() => setStep(0)} className="rq-btn rq-btn-main as-base mt-2 h-13 px-9">
                {props.button_label || t.quiz.start}
              </button>
            </div>
          ) : question && typeof step === "number" ? (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="as-xs font-bold as-muted">{t.quiz.progress(step + 1, props.questions.length)}</span>
                {step > 0 ? (
                  <button type="button" onClick={() => setStep(step - 1)} className="as-xs flex items-center gap-1 font-bold text-(--as-primary)">
                    <ChevronRight className="size-4" aria-hidden />
                    {t.quiz.back}
                  </button>
                ) : null}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-(--as-primary) transition-[width]" style={{ width: `${((step + 1) / props.questions.length) * 100}%` }} />
              </div>
              <h3 className="rq-display as-2xl">{question.text}</h3>
              <ul className="grid gap-3 @3xl:grid-cols-2">
                {question.answers.map((answer, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => choose(i)}
                      className={cn("rq-card as-base flex w-full items-center gap-3 p-4 text-start font-semibold transition hover:border-(--as-primary)", picked[step] === i && "border-(--as-primary) ring-2 ring-(--as-primary)/30")}
                    >
                      <span className="rq-step-no as-xs shrink-0">{i + 1}</span>
                      {answer.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : current ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex max-w-2xl flex-col gap-2">
                  <span className="rq-kicker">{remembered ? t.quiz.remembered : t.quiz.yourResult}</span>
                  <h2 className="rq-display rq-title">{current.name}</h2>
                  {current.text ? <p className="as-base as-muted">{current.text}</p> : null}
                </div>
                <button type="button" onClick={restart} className="rq-btn rq-btn-ink as-sm h-11 px-5">
                  <RotateCcw className="size-4" aria-hidden />
                  {t.quiz.again}
                </button>
              </div>
              {products.length > 0 ? <Grid products={products} /> : category ? null : <Empty text={t.empty.quizProducts} />}
              <div className="flex flex-wrap items-center gap-3">
                {products.length > 1 ? (
                  <button type="button" onClick={() => mode === "live" && shop && setAdded(addAllToCart(products, products.length < current.product_ids.length))} className="rq-btn rq-btn-main as-base h-12 px-7">
                    {added === "added" ? <Check className="size-5" aria-hidden /> : null}
                    {added === "added" ? t.routine.added : t.routine.add}
                  </button>
                ) : null}
                {category ? (
                  <StoreLink href={category} className="rq-btn rq-btn-ink as-base h-12 px-7">
                    {t.quiz.category}
                  </StoreLink>
                ) : null}
                {added === "choose" || added === "gone" ? (
                  <p className="as-xs font-semibold text-red-600" role="alert">
                    {added === "choose" ? t.routine.choose : t.routine.gone}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 17. care tips ---------- */

function Reader({ article, image, href, onClose }: { article: Article; image: MediaUrls | null; href: string | null; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center @3xl:items-center @3xl:p-6" role="dialog" aria-modal="true" aria-label={article.title}>
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={t.articles.close} />
      <article className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[2rem] bg-(--as-bg) @3xl:rounded-[2rem]">
        {image ? <Photo urls={image} alt={article.title} className="aspect-[16/9] w-full shrink-0" /> : null}
        <button type="button" onClick={onClose} className="absolute end-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 text-black shadow" aria-label={t.articles.close}>
          <X className="size-5" />
        </button>
        <div className="flex flex-col gap-3 p-6 @3xl:p-9">
          {article.tag ? <span className="rq-kicker">{article.tag}</span> : null}
          <h3 className="rq-display as-2xl">{article.title}</h3>
          <p className="as-base as-muted whitespace-pre-line leading-loose">{article.body}</p>
          {href ? (
            <StoreLink href={href} className="rq-btn rq-btn-main as-base mt-3 h-12 w-fit px-7">
              {t.articles.more}
            </StoreLink>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function Articles({ id, props }: { id: string; props: ArticlesProps }) {
  const { data } = useRawaq();
  const image = useImage();
  const [open, setOpen] = React.useState<number | null>(null);
  const close = React.useCallback(() => setOpen(null), []);
  const reading = open === null ? null : props.items[open];
  return (
    <section className="rq-section rq-reveal">
      <div className="rq-wrap flex flex-col gap-7">
        <Head kicker={props.kicker} title={props.title} />
        <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">
          {props.items.map((item, i) => {
            const href = data.links[`${id}:${i}`] ?? null;
            const urls = image(item.media_id);
            const body = (
              <>
                {urls ? (
                  <Photo urls={urls} size="medium" alt="" className="aspect-[16/10] w-full" />
                ) : (
                  <span aria-hidden className="block aspect-[16/10] w-full" style={{ background: SOFT[i % SOFT.length] }} />
                )}
                <span className="flex flex-1 flex-col gap-2 p-5">
                  {item.tag ? <span className="rq-kicker">{item.tag}</span> : null}
                  <b className="as-lg">{item.title}</b>
                  {item.body ? <span className="as-sm as-muted line-clamp-2">{item.body}</span> : null}
                  {item.body ? <span className="as-sm mt-auto pt-1 font-bold text-(--as-primary)">{t.articles.read}</span> : null}
                </span>
              </>
            );
            const look = "rq-card flex h-full flex-col overflow-hidden text-start transition hover:-translate-y-0.5";
            return (
              <li key={i}>
                {item.body ? (
                  <button type="button" onClick={() => setOpen(i)} className={cn(look, "w-full")}>
                    {body}
                  </button>
                ) : href ? (
                  <StoreLink href={href} className={look}>
                    {body}
                  </StoreLink>
                ) : (
                  <div className={look}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {reading && open !== null ? <Reader article={reading} image={image(reading.media_id)} href={data.links[`${id}:${open}`] ?? null} onClose={close} /> : null}
    </section>
  );
}

/** One home section of «رواق». */
export function SectionView({ section }: { section: RawaqSection }) {
  const id = section.id;
  switch (section.type) {
    case "glow_hero":
      return <GlowHero id={id} props={section.props} />;
    case "features":
      return <Trust props={section.props} />;
    case "shortcuts":
      return <Shortcuts id={id} props={section.props} />;
    case "categories":
      return <Categories id={id} props={section.props} />;
    case "product_tabs":
      return <ProductTabs id={id} props={section.props} />;
    case "products":
      return <Products id={id} props={section.props} />;
    case "routine":
      return <Routine id={id} props={section.props} />;
    case "banners":
      return <Banners id={id} props={section.props} />;
    case "countdown":
      return <Countdown id={id} props={section.props} />;
    case "reels":
      return <Reels props={section.props} />;
    case "video":
      return <Video props={section.props} />;
    case "ingredients":
      return <Ingredients id={id} props={section.props} />;
    case "brands":
      return <Brands id={id} props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "cta":
      return <Cta id={id} props={section.props} />;
    case "before_after":
      return <BeforeAfter props={section.props} />;
    case "skin_quiz":
      return <SkinQuiz id={id} props={section.props} />;
    case "articles":
      return <Articles id={id} props={section.props} />;
    case "ai":
      return <StoreAiSection section={section} themeKey="rawaq_store" />;
  }
}
