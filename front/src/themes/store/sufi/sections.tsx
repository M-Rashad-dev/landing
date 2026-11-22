"use client";

import { ArrowLeft, ArrowRight, Check, ExternalLink, ImageOff, MapPin, MessageCircle, Phone, Play, Plus, ShoppingBag, Star } from "lucide-react";
import { toast } from "@/components/ui/feedback";
import { useRouter } from "next/navigation";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { addToCart, MAX_LINE_QUANTITY } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { unitPriceAfter } from "@/lib/store/offers";
import type { ProductPage } from "@/lib/store/types";
import { track } from "@/lib/tracking/track";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreAiSection } from "@/themes/store/shared/ai-section";
import { StoreLink, useTheme } from "@/themes/store/shared/context";
import { FEATURE_ICONS } from "../asas/icons";
import { QuantityStepper } from "../asas/parts";
import { unitsLeft, variantKey } from "../shared/use-product-buy";
import type { MediaUrls } from "@/themes/shared/design";
import type { FeaturesProps, ProductsProps, TestimonialsProps } from "../asas/types";
import { pick } from "@/themes/shared/design";
import { ProductCard } from "./card";
import {
  embedUrl,
  mapEmbed,
  youtubePoster,
  type BannersProps,
  type BrandsProps,
  type CategoriesProps,
  type CountdownProps,
  type FaqProps,
  type FeaturedProps,
  type GalleryProps,
  type HeroProps,
  type LocationProps,
  type MarqueeProps,
  type StoryProps,
  type SufiData,
  type SufiSection,
  type SufiSettings,
  type TabsProps,
  type VideoProps,
} from "./types";

const t = ar.sufi;

function useSufi() {
  const theme = useTheme();
  return { ...theme, settings: theme.settings as SufiSettings, data: theme.data as SufiData };
}

/** An uploaded picture (Builder uploads first, then the saved data). */
function useImage() {
  const { media, data } = useSufi();
  return (id: number | null | undefined, size: "thumb" | "medium" | "large" = "large") => (id ? pick((media[String(id)] ?? data.media[String(id)]) as MediaUrls | undefined, size) : null);
}

function Img({ src, alt = "", className }: { src: string | null; alt?: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
    <img src={src} alt={alt} loading="lazy" className={cn("size-full object-cover", className)} />
  ) : (
    <span className={cn("flex size-full items-center justify-center bg-(--sf-soft) opacity-50", className)}>
      <ImageOff className="size-8" aria-hidden />
    </span>
  );
}

function Heading({ title, text, start = false, kicker }: { title: string | null; text?: string | null; start?: boolean; kicker?: string | null }) {
  if (!title && !text && !kicker) return null;
  return (
    <div className={cn("sf-reveal mb-8 @5xl:mb-11", start ? "text-start" : "text-center")}>
      {kicker ? <p className="sf-kicker mb-2">{kicker}</p> : null}
      {title ? <h2 className="sf-title">{title}</h2> : null}
      {text ? <p className="as-base mt-2 opacity-60">{text}</p> : null}
      {!start && title ? (
        <div className="sf-orn" aria-hidden>
          <i />
          <b />
          <i />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 1. hero ---------- */

function Hero({ id, props }: { id: string; props: HeroProps }) {
  const { data, mode } = useSufi();
  const image = useImage();
  const [on, setOn] = React.useState(0);
  const count = props.slides.length;

  React.useEffect(() => {
    if (!props.autoplay || count < 2 || mode === "builder") return;
    const timer = window.setInterval(() => setOn((i) => (i + 1) % count), 6500);
    return () => window.clearInterval(timer);
  }, [props.autoplay, count, mode]);

  const slide = props.slides[Math.min(on, count - 1)];
  // Visitors never see the merchant's "add an image" hint: an empty hero simply isn't there.
  if (count === 0 && mode === "live") return null;
  return (
    <section className="sf-hero" data-height={props.height} data-merge={props.merge_header ? "" : undefined}>
      {count ? (
        props.slides.map((s, i) => (
          <div key={i} className="sf-slide" data-on={i === on ? "" : undefined} aria-hidden={i !== on}>
            {/* eslint-disable-next-line @next/next/no-img-element -- store images come from the media server */}
            <img src={image(s.media_id, "large") ?? ""} alt={s.title ?? ""} className="size-full object-cover" fetchPriority={i === 0 ? "high" : "auto"} />
          </div>
        ))
      ) : (
        <p className="as-sm absolute inset-0 flex items-center justify-center opacity-60">{t.empty.hero}</p>
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgb(10 10 12 / ${props.shade / 100 + 0.1}) 0%, rgb(10 10 12 / ${props.shade / 300}) 35%, rgb(10 10 12 / ${props.shade / 100 + 0.25}) 100%)` }} aria-hidden />
      {slide ? (
        <div className="absolute inset-x-0 bottom-0 pb-16 @5xl:pb-24">
          <div className="sf-wrap">
            <div className="max-w-2xl">
              {props.kicker ? <span className="as-xs mb-5 inline-block rounded-full border border-white/40 bg-white/10 px-4 py-1.5 font-semibold tracking-wider backdrop-blur">{props.kicker}</span> : null}
              {slide.title ? <h1>{slide.title}</h1> : null}
              {slide.text ? <p className="as-base mt-4 max-w-xl leading-8 opacity-90 @5xl:as-lg">{slide.text}</p> : null}
              {slide.button_label ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  <StoreLink href={data.links[`${id}:${on}`]} className="sf-btn sf-btn-primary">
                    {slide.button_label}
                    <ArrowLeft className="size-4" aria-hidden />
                  </StoreLink>
                  <StoreLink href="/offers" className="sf-btn sf-btn-glass">
                    {t.offers}
                  </StoreLink>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {count > 1 ? (
        <div className="absolute end-6 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 @3xl:flex @5xl:end-10">
          {props.slides.map((_, i) => (
            <button key={i} type="button" onClick={() => setOn(i)} className={cn("as-xs flex items-center gap-3 font-semibold transition", i === on ? "opacity-100" : "opacity-50")} aria-label={t.slide(i + 1)} aria-current={i === on}>
              <span dir="ltr">{String(i + 1).padStart(2, "0")}</span>
              <i className={cn("h-0.5 bg-white transition-all", i === on ? "w-16" : "w-7")} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ---------- 2. marquee ---------- */

function Marquee({ props }: { props: MarqueeProps }) {
  const speed = { slow: "60s", normal: "38s", fast: "22s" }[props.speed];
  // The list twice: the second copy follows the first so the loop never shows a gap.
  const items = [...props.items, ...props.items, ...props.items, ...props.items];
  return (
    <section className="sf-marquee py-4" aria-label={props.items.join(" · ")}>
      <div className="sf-marquee-track" style={{ "--sf-speed": speed } as React.CSSProperties} aria-hidden>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0">
            {items.map((item, i) => (
              <span key={`${copy}-${i}`} className="as-base flex items-center gap-6 pe-6 font-bold whitespace-nowrap">
                {item}
                <Star className="size-3.5 fill-(--as-primary) text-(--as-primary)" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 3. categories ---------- */

function Categories({ id, props }: { id: string; props: CategoriesProps }) {
  const { data, mode } = useSufi();
  const tiles = data.category_tiles?.[id] ?? [];
  if (tiles.length === 0 && mode === "live") return null;
  const shape = props.shape;
  const grid = props.layout === "grid";
  const style = { "--sf-cols": props.columns_mobile, "--sf-cols-lg": props.columns_desktop } as React.CSSProperties;
  return (
    <section className="sf-section">
      <div className="sf-wrap">
        <Heading title={props.title} text={props.description} />
        {tiles.length === 0 ? (
          <p className="as-sm text-center opacity-60">{t.empty.categories}</p>
        ) : (
          <div style={style} className={cn("sf-reveal", grid ? "grid grid-cols-[repeat(var(--sf-cols),minmax(0,1fr))] gap-4 @5xl:grid-cols-[repeat(var(--sf-cols-lg),minmax(0,1fr))] @5xl:gap-6" : "sf-slider auto-cols-[38%] @3xl:auto-cols-[22%] @5xl:auto-cols-[15%]")}>
            {tiles.map((c) => (
              <StoreLink key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="group block text-center">
                {shape === "card" ? (
                  <span className="relative block aspect-[3/4] overflow-hidden rounded-(--sf-radius)">
                    <Img src={pick(c.image?.urls, "medium")} alt={c.name} className="transition duration-500 group-hover:scale-105" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="as-base absolute inset-x-0 bottom-3 font-bold text-white">{c.name}</span>
                  </span>
                ) : (
                  <>
                    <span className={cn("block aspect-square overflow-hidden border-[5px] border-(--as-bg) bg-(--sf-soft) shadow-[0_0_0_1px_var(--as-line)]", shape === "circle" ? "rounded-full" : "rounded-(--sf-radius)")}>
                      <Img src={pick(c.image?.urls, "medium")} alt={c.name} className="transition duration-500 group-hover:scale-105" />
                    </span>
                    <span className="as-base mt-3 block font-bold">{c.name}</span>
                    <span className="as-xs block opacity-55">{t.products(c.products_count)}</span>
                  </>
                )}
              </StoreLink>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 4. product tabs ---------- */

const SLIDER_COLS = {
  products: "auto-cols-[72%] @3xl:auto-cols-[calc((100%-2rem)/3)] @5xl:auto-cols-[calc((100%-4.5rem)/4)] @5xl:gap-6",
  reviews: "auto-cols-[85%] @3xl:auto-cols-[calc((100%-1.25rem)/2)] @5xl:auto-cols-[calc((100%-2.5rem)/3)] gap-5",
};

function Slider({ children, label, cols = "products" }: { children: React.ReactNode; label: string; cols?: keyof typeof SLIDER_COLS }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [progress, setProgress] = React.useState(0);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    // RTL: going forward scrolls toward the left (negative scrollLeft).
    el?.scrollBy({ left: -dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? Math.abs(el.scrollLeft) / max : 1);
  };
  return (
    <div>
      <div ref={ref} onScroll={onScroll} className={cn("sf-slider", SLIDER_COLS[cols])} aria-label={label} tabIndex={0}>
        {children}
      </div>
      <div className="mt-8 flex items-center gap-4">
        <button type="button" onClick={() => scroll(-1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-(--as-bg)" aria-label={t.prev}>
          <ArrowRight className="size-4" />
        </button>
        <div className="relative h-0.5 flex-1 overflow-hidden rounded bg-(--as-line)">
          <i className="absolute inset-y-0 start-0 rounded bg-(--as-primary) transition-all" style={{ width: `${Math.max(12, progress * 100)}%` }} />
        </div>
        <button type="button" onClick={() => scroll(1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-(--as-bg)" aria-label={t.next}>
          <ArrowLeft className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ProductTabs({ id, props }: { id: string; props: TabsProps }) {
  const { data } = useSufi();
  const [tab, setTab] = React.useState(0);
  const products = data.products[`${id}:${Math.min(tab, props.tabs.length - 1)}`] ?? [];
  return (
    <section className="sf-section sf-band">
      <div className="sf-wrap">
        <Heading title={props.title} text={props.description} />
        {props.tabs.length > 1 ? (
          <div role="tablist" className="sf-reveal mx-auto mb-10 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border bg-(--as-bg) p-1">
            {props.tabs.map((tb, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)} className={cn("as-sm shrink-0 rounded-full px-5 py-2.5 font-bold transition", i === tab ? "bg-(--as-text) text-(--as-bg)" : "opacity-70 hover:opacity-100")}>
                {tb.label}
              </button>
            ))}
          </div>
        ) : null}
        {products.length ? (
          <Slider label={props.tabs[tab]?.label ?? ""}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Slider>
        ) : (
          <p className="as-sm text-center opacity-60">{t.empty.products}</p>
        )}
      </div>
    </section>
  );
}

/* ---------- 5. banners ---------- */

function Banners({ id, props }: { id: string; props: BannersProps }) {
  const { data } = useSufi();
  const image = useImage();
  const n = props.items.length;
  return (
    <section className="sf-section">
      <div className={cn("sf-wrap grid gap-5", n === 2 && "@3xl:grid-cols-[1.25fr_1fr]", n === 3 && "@3xl:grid-cols-3")}>
        {props.items.map((item, i) => (
          <StoreLink key={i} href={data.links[`${id}:${i}`]} className={cn("sf-reveal group relative block overflow-hidden rounded-[1.6rem] text-white", n === 1 ? "h-80 @5xl:h-[28rem]" : "h-80 @5xl:h-[27rem]")}>
            <Img src={image(item.media_id)} alt={item.title ?? ""} className="transition duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <span className="absolute bottom-7 start-7 flex flex-col items-start">
              {item.kicker ? <span className="as-xs font-semibold tracking-widest opacity-85">{item.kicker}</span> : null}
              {item.title ? <span className="as-2xl mt-1 max-w-sm font-extrabold leading-tight @5xl:as-3xl">{item.title}</span> : null}
              {item.button_label ? <span className="sf-btn sf-btn-white as-sm mt-4 h-11">{item.button_label}</span> : null}
            </span>
          </StoreLink>
        ))}
      </div>
    </section>
  );
}

/* ---------- 6. countdown ---------- */

const tick = (live: boolean) => (onChange: () => void) => {
  if (!live) return () => {};
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
};

/** The time to the second in the browser (null while the server draws the page: no mismatch). */
function useNow(live: boolean): number | null {
  const subscribe = React.useMemo(() => tick(live), [live]);
  return React.useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000) * 1000, () => null);
}

function Countdown({ id, props }: { id: string; props: CountdownProps }) {
  const { data, mode } = useSufi();
  const image = useImage();
  const now = useNow(mode !== "builder");
  const left = now === null ? null : Math.max(0, new Date(props.ends_at).getTime() - now);
  const ended = left === 0;
  if (ended && props.on_end === "hide" && mode === "live") return null;
  const parts = left === null ? null : [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  const labels = [t.countdown.days, t.countdown.hours, t.countdown.minutes, t.countdown.seconds];
  const img = image(props.media_id);
  return (
    <section className="sf-section">
      <div className={cn("sf-wrap")}>
        <div className={cn("sf-reveal grid overflow-hidden rounded-[1.8rem] bg-(--sf-soft)", img && "@3xl:grid-cols-2")}>
          <div className="flex flex-col justify-center p-8 @5xl:p-14">
            {props.kicker ? <span className="as-xs w-fit rounded-full bg-[#d9472b] px-3 py-1 font-bold text-white">{props.kicker}</span> : null}
            <h2 className="sf-title mt-4">{props.title}</h2>
            {props.text ? <p className="as-base mt-3 opacity-70">{props.text}</p> : null}
            {ended ? (
              <p className="as-lg mt-6 font-extrabold text-[#d9472b]">{t.countdown.ended}</p>
            ) : (
              <div className="mt-7 flex gap-2.5" role="timer" aria-live="off">
                {labels.map((label, i) => (
                  <div key={label} className="flex w-[4.6rem] flex-col items-center rounded-2xl bg-(--as-bg) py-3.5 @5xl:w-20">
                    <b className="as-2xl font-extrabold tabular-nums" dir="ltr">
                      {parts ? String(parts[i]).padStart(2, "0") : "--"}
                    </b>
                    <small className="as-xs opacity-60">{label}</small>
                  </div>
                ))}
              </div>
            )}
            {props.button_label && !ended ? (
              <StoreLink href={data.links[id]} className="sf-btn sf-btn-ink mt-8 w-fit">
                {props.button_label}
                <ArrowLeft className="size-4" aria-hidden />
              </StoreLink>
            ) : null}
          </div>
          {img ? (
            <div className="relative min-h-72">
              <Img src={img} className="absolute inset-0" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 7. featured product ---------- */

function FeaturedProduct({ id, props }: { id: string; props: FeaturedProps }) {
  const { data, mode } = useSufi();
  const entry = data.featured?.[id] ?? null;
  if (!entry) return mode === "builder" ? <p className="sf-section as-sm text-center opacity-60">{t.featured.gone}</p> : null;
  return <FeaturedView entry={entry} kicker={props.kicker} />;
}

function FeaturedView({ entry, kicker }: { entry: NonNullable<NonNullable<SufiData["featured"]>[string]>; kicker: string | null }) {
  const { mode } = useSufi();
  const router = useRouter();
  const { product, offers, rating } = entry;
  const page = { product, offers, low_stock_threshold: null } as unknown as ProductPage;
  const [chosen, setChosen] = React.useState<Record<number, number>>(() => Object.fromEntries(product.options.filter((o) => o.values.length === 1).map((o) => [o.id, o.values[0].id])));
  const [quantity, setQuantity] = React.useState(1);
  const [image, setImage] = React.useState(0);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showMissing, setShowMissing] = React.useState(false);

  const deltas = product.options.reduce((sum, o) => sum + (o.values.find((v) => v.id === chosen[o.id])?.price_delta ?? 0), 0);
  const price = Math.round((product.price + deltas) * 100) / 100;
  const offerPrice = unitPriceAfter(offers, price);
  const compare = product.compare_at_price && product.compare_at_price > product.price ? product.compare_at_price + deltas : null;
  const left = unitsLeft(page, chosen);
  const soldOut = left === 0;
  const href = `/products/${encodeURIComponent(product.slug)}`;
  const images = product.images;

  const valueOut = (optionId: number, valueId: number) => {
    const option = product.options.find((o) => o.id === optionId);
    if (product.stock_mode !== "variant" || !option?.is_required) return false;
    const key = variantKey(product.options, { ...chosen, [optionId]: valueId });
    return key !== null && (product.variant_stock?.[key] ?? 0) <= 0;
  };

  const add = (then: "cart" | "checkout") => {
    if (mode !== "live") {
      setMessage(t.featured.previewOnly);
      return;
    }
    // Fields to type or upload live on the product page.
    if (product.inputs?.length) {
      router.push(href);
      return;
    }
    const missing = product.options.filter((o) => o.is_required && chosen[o.id] === undefined);
    if (missing.length) {
      setShowMissing(true);
      setMessage(t.featured.pickAll);
      toast.error(ar.storefront.product.pickThese(missing.map((o) => o.name).join("، ")));
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
    const max = Math.min(MAX_LINE_QUANTITY, left ?? MAX_LINE_QUANTITY);
    const result = addToCart({ product_id: product.id, quantity: Math.min(quantity, max), options: chosen, name: product.name, slug: product.slug, image: pick(images[0]?.urls, "thumb"), price, options_label: label, max: left });
    if (result === "full") {
      setMessage(ar.storefront.product.cartFull);
      return;
    }
    if (result === "added") {
      sendStoreEvent("add_to_cart");
      track("AddToCart", { content_ids: [product.id], content_name: product.name, value: price * quantity, num_items: quantity });
      setMessage(t.added);
    }
    if (then === "checkout") router.push("/checkout");
  };

  return (
    <section className="sf-section sf-band">
      <div className="sf-wrap grid items-center gap-10 @5xl:grid-cols-[1.05fr_1fr] @5xl:gap-16">
        <div className="sf-reveal grid gap-3 @3xl:grid-cols-[5.5rem_1fr]">
          {images.length > 1 ? (
            <div className="order-2 flex gap-2.5 @3xl:order-none @3xl:flex-col">
              {images.slice(0, 5).map((img, i) => (
                <button key={img.id} type="button" onClick={() => setImage(i)} className={cn("h-24 w-20 shrink-0 overflow-hidden rounded-xl border-2", i === image ? "border-(--as-text)" : "border-transparent opacity-70")} aria-label={ar.storefront.product.image(i + 1)}>
                  <Img src={pick(img.urls, "thumb")} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.6rem] bg-(--sf-soft) @3xl:col-start-2">
            <Img src={pick(images[Math.min(image, images.length - 1)]?.urls, "large")} alt={product.name} />
            {compare ? <span className="as-sm absolute start-4 top-4 rounded-full bg-[#d9472b] px-3 py-1 font-bold text-white">{t.off(Math.round(((compare - price) / compare) * 100))}</span> : null}
          </div>
        </div>
        <div className="sf-reveal">
          {kicker ? <p className="sf-kicker">{kicker}</p> : null}
          <h2 className="sf-title mt-2">{product.name}</h2>
          {rating.count > 0 ? (
            <p className="as-sm mt-3 flex items-center gap-2 opacity-70">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
              {t.featured.reviews(rating.average, rating.count)}
            </p>
          ) : null}
          <p className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className={cn("as-3xl font-extrabold", (compare || offerPrice !== null) && "text-[#d9472b]")}>{formatMoney(offerPrice ?? price)}</span>
            {offerPrice !== null ? <span className="as-lg line-through opacity-50">{formatMoney(price)}</span> : compare ? <span className="as-lg line-through opacity-50">{formatMoney(compare)}</span> : null}
            {compare && offerPrice === null ? <span className="as-xs rounded-full bg-[#fbe3dd] px-3 py-1 font-bold text-[#d9472b]">{t.featured.save(formatMoney(compare - price))}</span> : null}
          </p>
          {product.short_description ? <p className="as-base mt-4 leading-8 opacity-75">{product.short_description}</p> : null}
          {product.options.map((o) => {
            const lacking = showMissing && o.is_required && chosen[o.id] === undefined;
            return (
              <div key={o.id} className={cn("mt-6 rounded-xl transition", lacking && "-mx-2 bg-red-500/5 p-2 ring-2 ring-red-500/70")}>
                <p className="as-sm mb-2.5 font-bold">
                  {o.name}
                  {o.is_required ? <span className="text-red-600" aria-hidden> *</span> : null}
                  {chosen[o.id] ? <span className="font-normal opacity-60">: {o.values.find((v) => v.id === chosen[o.id])?.label}</span> : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((v) => {
                    const out = valueOut(o.id, v.id);
                    const on = chosen[o.id] === v.id;
                    return v.color_hex ? (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out}
                        onClick={() => setChosen((c) => ({ ...c, [o.id]: v.id }))}
                        className={cn("relative flex size-11 items-center justify-center rounded-full transition disabled:opacity-30", on ? "ring-2 ring-(--as-text) ring-offset-2 ring-offset-(--as-bg)" : "ring-1 ring-(--as-line)")}
                        aria-label={v.label}
                        aria-pressed={on}
                      >
                        <span className="size-9 rounded-full border border-black/10" style={{ background: v.color_hex }} aria-hidden />
                        {on ? (
                          <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-(--as-text) text-(--as-bg)" aria-hidden>
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <button key={v.id} type="button" disabled={out} onClick={() => setChosen((c) => ({ ...c, [o.id]: v.id }))} className={cn("as-sm flex h-11 min-w-12 items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3 font-bold transition disabled:line-through disabled:opacity-35", on ? "border-(--as-text) bg-(--as-text) text-(--as-bg) shadow-sm" : "bg-(--as-bg) hover:border-(--as-text)/60")} aria-pressed={on}>
                        {on ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
                        {v.label}
                      </button>
                    );
                  })}
                </div>
                {lacking ? (
                  <p className="as-xs mt-2 font-bold text-red-600" role="alert">
                    {ar.storefront.product.pickOne(o.name)}
                  </p>
                ) : null}
              </div>
            );
          })}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(MAX_LINE_QUANTITY, left ?? MAX_LINE_QUANTITY))} label={t.featured.quantity} />
            <button type="button" onClick={() => add("cart")} disabled={soldOut} className="sf-btn sf-btn-ink h-14 min-w-48 flex-1 disabled:opacity-50">
              <ShoppingBag className="size-4" aria-hidden />
              {soldOut ? t.featured.soldOut : t.featured.add}
            </button>
          </div>
          {!soldOut ? (
            <button type="button" onClick={() => add("checkout")} className="sf-btn sf-btn-primary mt-3 h-14 w-full">
              {t.featured.buyNow}
            </button>
          ) : null}
          {message ? (
            <p className="as-sm mt-3 font-semibold" role="status">
              {message}
            </p>
          ) : null}
          <StoreLink href={href} className="as-sm mt-5 inline-flex items-center gap-1.5 font-bold underline-offset-4 hover:underline">
            {t.featured.details}
            <ArrowLeft className="size-4" aria-hidden />
          </StoreLink>
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. products ---------- */

function Products({ id, props }: { id: string; props: ProductsProps }) {
  const { data } = useSufi();
  const products = data.products[id] ?? [];
  const viewAll = props.show_view_all ? data.view_all[id] : null;
  const cols = { 2: "@3xl:grid-cols-2", 3: "@3xl:grid-cols-3", 4: "@3xl:grid-cols-3 @5xl:grid-cols-4", 5: "@3xl:grid-cols-3 @5xl:grid-cols-5" }[props.columns] ?? "@5xl:grid-cols-4";
  return (
    <section className="sf-section">
      <div className="sf-wrap">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 @5xl:mb-11">
          <Heading title={props.title} text={props.description} start />
          {viewAll ? (
            <StoreLink href={viewAll} className="sf-btn sf-btn-line as-sm mb-8 h-11 @5xl:mb-11">
              {t.viewAll}
              <ArrowLeft className="size-4" aria-hidden />
            </StoreLink>
          ) : null}
        </div>
        {products.length === 0 ? (
          <p className="as-sm text-center opacity-60">{t.empty.products}</p>
        ) : props.layout === "slider" ? (
          <Slider label={props.title}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Slider>
        ) : (
          <div className={cn("grid grid-cols-2 gap-3 @3xl:gap-6", cols)}>
            {products.map((p) => (
              <div key={p.id} className="sf-reveal">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 9. video ---------- */

function Video({ props }: { props: VideoProps }) {
  const { mode } = useSufi();
  const image = useImage();
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  const poster = image(props.cover_media_id) ?? youtubePoster(props.url);
  return (
    <section className="sf-section">
      <div className="sf-wrap">
        <div className="sf-reveal relative aspect-video overflow-hidden rounded-[1.8rem] bg-black text-white @5xl:aspect-[2.1/1]">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} className="absolute inset-0 size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} className="group absolute inset-0 block" aria-label={t.video.play}>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant cover or the video's own poster
                <img src={poster} alt="" className="size-full object-cover" loading="lazy" />
              ) : null}
              <span className="absolute inset-0 bg-black/45" />
              <span className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <span className="flex size-20 items-center justify-center rounded-full bg-white text-[#17181c] shadow-[0_0_0_16px_rgb(255_255_255/0.18)] transition group-hover:scale-105 @5xl:size-24">
                  <Play className="size-8 fill-current" aria-hidden />
                </span>
                {props.title ? <span className="sf-title mt-10 block">{props.title}</span> : null}
                {props.text ? <span className="as-base mt-2 block opacity-85">{props.text}</span> : null}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 10. brands ---------- */

function Brands({ id, props }: { id: string; props: BrandsProps }) {
  const { data } = useSufi();
  const image = useImage();
  return (
    <section className="sf-section">
      <div className="sf-wrap">
        <Heading title={props.title} />
        <div className="sf-reveal grid grid-cols-3 gap-3 rounded-[1.6rem] border bg-(--sf-surface) p-5 @3xl:grid-cols-4 @5xl:grid-cols-6 @5xl:p-8">
          {props.items.map((b, i) => (
            <StoreLink key={i} href={data.links[`${id}:${i}`]} className="flex h-20 items-center justify-center p-2 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" aria-label={b.name ?? undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element -- store images come from the media server */}
              <img src={image(b.media_id, "medium") ?? ""} alt={b.name ?? ""} loading="lazy" className="max-h-full max-w-full object-contain" />
            </StoreLink>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 11. story ---------- */

function Story({ id, props }: { id: string; props: StoryProps }) {
  const { data } = useSufi();
  const image = useImage();
  const second = image(props.media2_id, "medium");
  return (
    <section className="sf-section sf-band">
      <div className="sf-wrap grid items-center gap-12 @5xl:grid-cols-2 @5xl:gap-20">
        <div className="sf-reveal relative">
          <div className="aspect-[4/5] overflow-hidden rounded-[1.8rem] @5xl:aspect-auto @5xl:h-[36rem]">
            <Img src={image(props.media_id)} />
          </div>
          {second ? (
            <div className="absolute -bottom-6 end-4 hidden h-60 w-48 overflow-hidden rounded-[1.4rem] border-8 border-(--sf-surface) @3xl:block">
              <Img src={second} />
            </div>
          ) : null}
        </div>
        <div className="sf-reveal">
          {props.kicker ? <p className="sf-kicker">{props.kicker}</p> : null}
          <h2 className="sf-title mt-3 @5xl:text-[calc(var(--as-fs)*2.6rem)]">{props.title}</h2>
          {props.text ? <p className="as-base mt-5 leading-9 whitespace-pre-line opacity-75">{props.text}</p> : null}
          {props.stats.length ? (
            <div className="mt-8 flex flex-wrap gap-10">
              {props.stats.map((s, i) => (
                <div key={i}>
                  <b className="as-3xl block font-extrabold" dir="auto">
                    {s.value}
                  </b>
                  <small className="as-sm opacity-60">{s.label}</small>
                </div>
              ))}
            </div>
          ) : null}
          {props.button_label ? (
            <StoreLink href={data.links[id]} className="sf-btn sf-btn-ink mt-9">
              {props.button_label}
            </StoreLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- 12. features ---------- */

function Features({ props }: { props: FeaturesProps }) {
  return (
    <section className="sf-section">
      <div className="sf-wrap">
        <Heading title={props.title} />
        <div className="sf-reveal grid overflow-hidden rounded-[1.6rem] border bg-(--sf-surface) @3xl:grid-cols-2 @5xl:grid-cols-4">
          {props.items.map((item, i) => {
            const Icon = FEATURE_ICONS[item.icon];
            return (
              <div key={i} className="flex items-start gap-4 border-b p-7 last:border-b-0 @5xl:border-e @5xl:border-b-0 @5xl:last:border-e-0">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-(--sf-soft) text-(--as-primary)">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span>
                  <b className="as-base block">{item.title}</b>
                  {item.text ? <span className="as-sm mt-1 block leading-7 opacity-60">{item.text}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- 13. testimonials ---------- */

function Testimonials({ props }: { props: TestimonialsProps }) {
  const { data } = useSufi();
  const items = props.source === "auto" ? data.reviews : props.items;
  if (items.length === 0) return null;
  // The merchant's choice, on every screen: a slider with arrows, or all of them in a grid.
  const slider = (props.layout ?? "slider") === "slider" && items.length > 1;
  const cards = items.slice(0, 12).map((r, i) => (
    <article key={i} className="sf-reveal h-full rounded-[1.4rem] border bg-(--sf-surface) p-7">
              <p className="flex gap-0.5" aria-label={ar.storefront.reviews.outOf(r.rating)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={cn("size-4", n <= r.rating ? "fill-amber-400 text-amber-400" : "opacity-25")} aria-hidden />
                ))}
              </p>
              <p className="as-base my-5 leading-8">{r.text}</p>
              <p className="flex items-center gap-3">
                <span className="as-base flex size-11 items-center justify-center rounded-full bg-(--sf-soft) font-extrabold text-(--as-primary)">{r.name.trim().charAt(0)}</span>
                <b className="as-sm">{r.name}</b>
              </p>
    </article>
  ));
  return (
    <section className="sf-section">
      <div className="sf-wrap">
        <Heading title={props.title} />
        {slider ? (
          <Slider label={props.title ?? ar.storefront.reviews.title} cols="reviews">
            {cards}
          </Slider>
        ) : (
          <div className="grid gap-5 @3xl:grid-cols-2 @5xl:grid-cols-3">{cards}</div>
        )}
      </div>
    </section>
  );
}

/* ---------- 14. gallery ---------- */

function Gallery({ id, props }: { id: string; props: GalleryProps }) {
  const { data } = useSufi();
  const image = useImage();
  // Cells before the last tile (the first one takes 4), then how wide the last must be to end its row.
  const before = 4 + props.items.length - 2;
  const fill = (cols: number) => cols - (before % cols);
  const fills = { "--sf-fill-sm": fill(2), "--sf-fill-md": fill(4), "--sf-fill-lg": fill(6) } as React.CSSProperties;
  return (
    <section className="sf-section sf-band">
      <div className="sf-wrap">
        <Heading title={props.title} text={props.description} />
        <div className="sf-reveal grid auto-rows-[9rem] grid-cols-2 gap-3 @3xl:auto-rows-[12rem] @3xl:grid-cols-4 @5xl:grid-cols-6">
          {props.items.map((item, i) => (
            <StoreLink key={i} href={data.links[`${id}:${i}`]} style={i > 0 && i === props.items.length - 1 ? fills : undefined} className={cn("group relative block overflow-hidden rounded-2xl", i === 0 && "col-span-2 row-span-2", i > 0 && i === props.items.length - 1 && "sf-gal-last")}>
              <Img src={image(item.media_id, i === 0 ? "large" : "medium")} alt={item.label ?? ""} className="transition duration-700 group-hover:scale-105" />
              {item.label ? <span className="as-xs absolute start-3 bottom-3 rounded-full bg-white px-3 py-1.5 font-bold text-[#17181c]">{item.label}</span> : null}
            </StoreLink>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 15. faq ---------- */

function Faq({ props }: { props: FaqProps }) {
  const { settings } = useSufi();
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);
  const uid = React.useId();
  const wa = props.whatsapp_button && settings.footer.whatsapp ? `https://wa.me/${settings.footer.whatsapp.replace(/\D/g, "").replace(/^0/, "20")}` : null;
  return (
    <section className="sf-section">
      <div className="sf-wrap grid gap-10 @5xl:grid-cols-[22rem_1fr] @5xl:gap-16">
        <div className="sf-reveal">
          {props.title ? <h2 className="sf-title">{props.title}</h2> : null}
          {props.text ? <p className="as-base mt-3 leading-8 opacity-65">{props.text}</p> : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="sf-btn mt-6 bg-[#25d366] text-[#0b2b17]">
              <MessageCircle className="size-5" aria-hidden />
              {t.faq.whatsapp}
            </a>
          ) : null}
        </div>
        <div className="sf-reveal">
          {props.items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="sf-qa border-b" data-open={isOpen ? "" : undefined}>
                <h3>
                  <button
                    type="button"
                    id={`${uid}-q${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`${uid}-a${i}`}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="as-base flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-start font-bold"
                  >
                    {item.question}
                    <span className="sf-qa-icon flex size-9 shrink-0 items-center justify-center rounded-full border">
                      <Plus className="size-4" aria-hidden />
                    </span>
                  </button>
                </h3>
                {/* One question open at a time; the answer slides open and shut (grid rows 0fr ↔ 1fr, sufi.css). */}
                <div id={`${uid}-a${i}`} role="region" aria-labelledby={`${uid}-q${i}`} className="sf-qa-body">
                  <div className="overflow-hidden">
                    <p className="as-sm max-w-2xl pb-5 leading-8 whitespace-pre-line opacity-75">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- 16. location ---------- */

function Location({ props }: { props: LocationProps }) {
  const { mode } = useSufi();
  const [on, setOn] = React.useState(0);
  const branch = props.branches[Math.min(on, props.branches.length - 1)];
  return (
    <section className="sf-section sf-band">
      <div className="sf-wrap">
        <Heading title={props.title} text={props.description} />
        <div className="grid gap-5 @5xl:grid-cols-[22rem_1fr]">
          <div className="flex flex-col gap-3">
            {props.branches.map((b, i) => (
              <button key={i} type="button" onClick={() => setOn(i)} className={cn("rounded-2xl border bg-(--as-bg) p-5 text-start transition", i === on && "border-(--as-primary) shadow-[0_0_0_3px_var(--sf-soft)]")} aria-pressed={i === on}>
                <b className="as-base flex items-center gap-2">
                  <MapPin className="size-4 text-(--as-primary)" aria-hidden />
                  {b.name}
                </b>
                <span className="as-sm mt-2 block leading-7 opacity-65">{b.address}</span>
                {b.hours || b.phone ? (
                  <span className="as-xs mt-2 flex flex-wrap gap-4 opacity-80">
                    {b.hours ? <span>{b.hours}</span> : null}
                    {b.phone ? (
                      <span className="flex items-center gap-1" dir="ltr">
                        <Phone className="size-3" aria-hidden />
                        {b.phone}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {branch ? (
            <div className="sf-reveal relative h-80 overflow-hidden rounded-[1.6rem] border @5xl:h-[30rem]">
              {mode !== "builder" ? (
                <iframe key={on} src={mapEmbed(branch)} title={branch.name} className="size-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <span className="flex size-full items-center justify-center bg-(--sf-soft)">
                  <MapPin className="size-10 text-(--as-primary)" aria-hidden />
                </span>
              )}
              <a href={branch.map_url} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-ink as-sm absolute bottom-4 start-4 h-11 shadow-xl">
                {t.location.open}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SectionView({ section }: { section: SufiSection }) {
  switch (section.type) {
    case "hero":
      return <Hero id={section.id} props={section.props} />;
    case "marquee":
      return <Marquee props={section.props} />;
    case "categories":
      return <Categories id={section.id} props={section.props} />;
    case "product_tabs":
      return <ProductTabs id={section.id} props={section.props} />;
    case "banners":
      return <Banners id={section.id} props={section.props} />;
    case "countdown":
      return <Countdown id={section.id} props={section.props} />;
    case "featured_product":
      return <FeaturedProduct id={section.id} props={section.props} />;
    case "products":
      return <Products id={section.id} props={section.props} />;
    case "video":
      return <Video props={section.props} />;
    case "brands":
      return <Brands id={section.id} props={section.props} />;
    case "story":
      return <Story id={section.id} props={section.props} />;
    case "features":
      return <Features props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "gallery":
      return <Gallery id={section.id} props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "location":
      return <Location props={section.props} />;
    case "ai":
      return <StoreAiSection section={section} themeKey="sufi_store" />;
    default:
      return null;
  }
}
