"use client";

import { BadgeCheck, ChevronDown, Headset, Play, Star, Wrench, Zap, type LucideIcon } from "lucide-react";
import * as React from "react";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick } from "@/themes/shared/design";
import { StoreAiSection } from "@/themes/store/shared/ai-section";
import { whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink } from "@/themes/store/shared/context";
import type { ProductCard } from "@/themes/store/shared/types";
import { pad, timeLeft, useNow } from "@/themes/store/shared/use-countdown";
import { FEATURE_ICONS } from "../asas/icons";
import type { ProductsProps } from "../asas/types";
import type { CtaProps } from "../rawaq/types";
import { embedUrl, youtubePoster, type BannersProps, type BrandsProps, type CategoriesProps, type CountdownProps, type FaqProps, type VideoProps } from "../sufi/types";
import { TeknoCard } from "./card";
import { dealStock, dealTimeLeft } from "./deal";
import { installmentOf } from "./installments";
import { Empty, Head, Money, Photo, Stars, useImage } from "./parts";
import { useInstallments, useTekno } from "./root";
import type { DealOfDayProps, HeroSlide, ServicesProps, TechHeroProps, TechIcon, TeknoFeaturesProps, TeknoSection, TeknoTabsProps, TeknoTestimonialsProps } from "./types";

const t = ar.teknoStore;

/** The trust strip's and services' icons: the store set plus maintenance, support and a warranty badge. */
const TECH_ICONS: Record<TechIcon, LucideIcon> = { ...FEATURE_ICONS, wrench: Wrench, headset: Headset, "badge-check": BadgeCheck };

/** How often the opening turns to its next slide (paused while hovered; never in the Builder). */
const SLIDE_EVERY_MS = 6000;

function Grid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="tk-grid">
      {products.map((p) => (
        <li key={p.id}>
          <TeknoCard product={p} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- 1. the opening: a slider and two side tiles ---------- */

function Title({ title, highlight }: { title: string; highlight: string | null }) {
  const parts = highlight && title.includes(highlight) ? title.split(highlight) : null;
  if (!parts) return <>{title}</>;
  return (
    <>
      {parts[0]}
      <em>{highlight}</em>
      {parts.slice(1).join(highlight ?? "")}
    </>
  );
}

function Slide({ id, index, slide }: { id: string; index: number; slide: HeroSlide }) {
  const { data } = useTekno();
  const plan = useInstallments();
  const image = useImage()(slide.media_id);
  const product = slide.product_id ? (data.products[`${id}:${index}`]?.[0] ?? null) : null;
  const sale = product && product.compare_at_price !== null && product.compare_at_price > product.price;
  const installment = product ? installmentOf(product.price, plan) : null;
  const href = data.links[`${id}:${index}`] ?? null;
  return (
    <div className="grid h-full items-center gap-3 p-4 @3xl:min-h-[23.75rem] @3xl:grid-cols-[1.1fr_1fr] @3xl:gap-6 @3xl:p-[2.125rem]">
      {/* A phone opens the slide's link from anywhere on it (the buttons are the computer's). */}
      <StoreLink href={href} className="absolute inset-0 z-1 @3xl:hidden" aria-label={slide.title}>
        <span className="sr-only">{slide.button_label}</span>
      </StoreLink>
      <div className="flex flex-col gap-2 @3xl:gap-0">
        {slide.kicker ? <span className="tk-kicker !text-(--as-secondary)">{slide.kicker}</span> : null}
        <h1 className="tk-display text-[1.25rem] leading-snug @3xl:mt-1 @3xl:text-[2rem] @3xl:leading-[1.2] @5xl:text-[2.75rem]">
          <Title title={slide.title} highlight={slide.highlight} />
        </h1>
        {slide.subtitle ? <p className="as-sm hidden max-w-xl leading-relaxed text-slate-300 @3xl:mt-3 @3xl:block">{slide.subtitle}</p> : null}
        {slide.chips.length ? (
          <ul className="tk-specs as-sm hidden @3xl:my-3.5 @3xl:flex">
            {slide.chips.map((chip, i) => (
              <li key={i}>{chip}</li>
            ))}
          </ul>
        ) : null}
        {product ? (
          <>
            <p className="as-xs font-extrabold text-(--tk-deal) @3xl:hidden">
              {formatMoney(product.price)}
              {installment ? ` · ${t.card.installment(installment.amount)}` : null}
            </p>
            <p className="hidden items-baseline gap-3.5 @3xl:flex">
              <Money value={product.price} className="text-[2.125rem]" />
              {sale ? <s className="as-sm text-slate-400">{formatNumber(product.compare_at_price!)}</s> : null}
            </p>
            {installment ? <span className="tk-inst as-sm mt-2.5 hidden w-fit @3xl:inline-flex">{t.hero.installment(installment.amount)}</span> : null}
          </>
        ) : null}
        <div className="mt-5 hidden flex-wrap gap-3 @3xl:flex">
          <StoreLink href={href} className="tk-btn tk-btn-main">
            {slide.button_label}
          </StoreLink>
          {slide.second_label ? (
            <StoreLink href={data.links[`${id}:${index}:second`] ?? null} className="tk-btn tk-btn-ghost">
              {slide.second_label}
            </StoreLink>
          ) : null}
        </div>
      </div>
      <Photo urls={image} alt={slide.title} className="tk-slide-photo h-[8.125rem] w-full @3xl:h-[18.75rem]" />
    </div>
  );
}

function TechHero({ id, props }: { id: string; props: TechHeroProps }) {
  const { data, mode } = useTekno();
  const image = useImage();
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = props.slides.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const turning = mode !== "builder" && count > 1 && !paused;

  React.useEffect(() => {
    if (!turning) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [turning, count]);

  const slide = props.slides[current];
  if (!slide) return null;
  return (
    <section className="tk-hero">
      <div className={cn("tk-wrap grid gap-[1.125rem] pb-1 pt-3 @3xl:pb-10 @3xl:pt-[2.125rem]", props.tiles.length && "@3xl:grid-cols-[2.1fr_1fr]")}>
        <div className="tk-slide" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label={slide.title}>
          <Slide key={current} id={id} index={current} slide={slide} />
          {count > 1 ? (
            <div className="tk-dots absolute bottom-4 start-4 z-2 @3xl:start-[2.125rem]">
              {props.slides.map((s, i) => (
                <button key={i} type="button" onClick={() => setIndex(i)} aria-current={i === current} aria-label={t.hero.slide(i + 1)} />
              ))}
            </div>
          ) : null}
        </div>
        {props.tiles.length ? (
          <div className="hidden flex-col gap-[1.125rem] @3xl:flex">
            {props.tiles.map((tile, i) => {
              const urls = image(tile.media_id);
              return (
                <StoreLink key={i} href={data.links[`${id}:tile:${i}`] ?? null} className="tk-tile flex-1" style={{ background: tile.color ?? "var(--tk-deep)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- store media, already resized */}
                  {urls ? <img src={pick(urls, "medium") ?? ""} alt="" loading="lazy" /> : null}
                  <span className="flex flex-col">
                    {tile.kicker ? <span className="tk-kicker !text-white/75">{tile.kicker}</span> : null}
                    <b className="tk-display text-xl">{tile.title}</b>
                    {tile.text ? <span className="as-sm mt-1 font-extrabold">{tile.text}</span> : null}
                  </span>
                </StoreLink>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- 2. the trust strip ---------- */

function Trust({ props }: { props: TeknoFeaturesProps }) {
  return (
    <section className="tk-trust">
      <div className="tk-wrap py-3 @3xl:py-[1.125rem]">
        {props.title ? <h2 className="tk-display as-lg mb-3 text-center">{props.title}</h2> : null}
        <ul className="tk-row-scroll @3xl:grid @3xl:gap-3" style={{ gridTemplateColumns: `repeat(${props.items.length}, minmax(0, 1fr))` }}>
          {props.items.map((item, i) => {
            const Icon = TECH_ICONS[item.icon] ?? Star;
            return (
              <li key={i} className="flex min-w-[11rem] shrink-0 items-center gap-2.5 @3xl:min-w-0">
                <span className="tk-trust-icon">
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

/* ---------- 3. categories ---------- */

function Categories({ id, props }: { id: string; props: CategoriesProps }) {
  const { data } = useTekno();
  const tiles = data.category_tiles?.[id] ?? [];
  const slider = props.layout === "slider";
  return (
    <section className="tk-section">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-[1.375rem]">
        <Head
          title={props.title}
          text={props.description}
          end={
            <StoreLink href="/products" className="tk-more hidden @3xl:inline">
              {t.allCategoriesLink}
            </StoreLink>
          }
        />
        {tiles.length ? (
          <ul className={cn("tk-row-scroll @3xl:gap-3.5", !slider && "@3xl:grid @3xl:grid-cols-[repeat(var(--cols),minmax(0,1fr))]")} style={{ "--cols": props.columns_desktop } as React.CSSProperties}>
            {tiles.map((c) => (
              <li key={c.id} className={cn("w-16 shrink-0", slider ? "@3xl:w-36" : "@3xl:w-auto")}>
                <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="tk-cat as-xs @3xl:as-sm">
                  <span className={cn("tk-cat-photo", props.shape !== "circle" && "!rounded-xl")}>
                    <Photo urls={c.image?.urls} size="thumb" alt="" className="size-full" />
                  </span>
                  <span className="line-clamp-2 leading-tight">{c.name}</span>
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

/* ---------- 4. «عرض اليوم» ---------- */

function DealOfDay({ id, props }: { id: string; props: DealOfDayProps }) {
  const { data, mode } = useTekno();
  const plan = useInstallments();
  const now = useNow(mode !== "builder");
  const product = data.products[id]?.[0] ?? null;
  const left = dealTimeLeft(props, now);
  if (!product) return <Empty text={t.empty.deal} />;
  if (left?.ended && mode !== "builder") return null;
  const href = `/products/${encodeURIComponent(product.slug)}`;
  const chips = props.chips ?? (product.spec_chips ?? []).map((c) => c.value);
  const title = props.title ?? product.name;
  const sale = product.compare_at_price !== null && product.compare_at_price > product.price;
  const installment = props.show_installment ? installmentOf(product.price, plan) : null;
  const stock = dealStock(props.stock_start, product.max_quantity);
  const clock = left ? [left.days * 24 + left.hours, left.minutes, left.seconds] : null;
  const units = [t.deal.units.hours, t.deal.units.minutes, t.deal.units.seconds];
  const image = product.image?.urls;

  return (
    <section className="tk-section @3xl:pt-2.5">
      <div className="tk-wrap">
        {left?.ended ? <p className="as-sm mb-2 rounded-xl bg-amber-50 p-3 font-semibold text-amber-800">{t.empty.dealEnded}</p> : null}
        {/* A phone: the compact card of the phone image (the whole card opens the product). */}
        <StoreLink href={href} className="tk-deal grid grid-cols-[6.875rem_1fr] items-center gap-2.5 p-3 @3xl:hidden">
          <Photo urls={image} size="medium" alt={title} className="size-[6.875rem] rounded-xl bg-white" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="as-xs flex items-center gap-1 font-extrabold text-(--tk-deal)">
              <Zap className="size-3 fill-current" aria-hidden />
              <span className="truncate">{props.kicker ?? t.todayOffers}</span>
            </span>
            <b className="as-sm line-clamp-2">{title}</b>
            <Money value={product.price} className="text-lg" />
            {clock ? (
              <span className="as-xs font-extrabold text-(--as-secondary)" dir="ltr">
                {clock.map(pad).join(" : ")}
              </span>
            ) : null}
          </span>
        </StoreLink>
        <div className="tk-deal hidden items-center gap-[2.125rem] p-[2.125rem] @3xl:grid @3xl:grid-cols-[1fr_1.3fr]">
          <StoreLink href={href} className="block overflow-hidden rounded-[1.25rem] bg-white">
            <Photo urls={image} alt={title} className="h-[18.75rem] w-full" />
          </StoreLink>
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3">
              {props.kicker ? (
                <span className="tk-kicker flex items-center gap-1.5 text-[0.9375rem] !text-(--tk-deal)">
                  <Zap className="size-4 fill-current" aria-hidden />
                  {props.kicker}
                </span>
              ) : (
                <span />
              )}
              {product.discount_percent ? <span className="as-xs rounded-lg bg-(--tk-red) px-2 py-0.5 font-extrabold text-white">{t.deal.off(product.discount_percent)}</span> : null}
            </div>
            <h2 className="tk-display mb-1.5 mt-2.5 text-[2.125rem] leading-tight">{title}</h2>
            {chips.length ? (
              <ul className="tk-specs as-sm my-3.5">
                {chips.map((chip, i) => (
                  <li key={i}>{chip}</li>
                ))}
              </ul>
            ) : null}
            <p className="flex flex-wrap items-center gap-3.5">
              <Money value={product.price} className="text-[2.25rem]" />
              {sale ? <s className="as-sm text-slate-400">{formatNumber(product.compare_at_price!)}</s> : null}
              {installment ? <span className="tk-inst as-sm">{t.deal.installment(installment.amount)}</span> : null}
            </p>
            {stock ? (
              <>
                <p className="as-sm mb-2 mt-[1.125rem] font-extrabold">{t.deal.sold(stock.percent, stock.left)}</p>
                <div className="tk-bar" role="progressbar" aria-valuenow={stock.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t.deal.sold(stock.percent, stock.left)}>
                  <i style={{ width: `${stock.percent}%` }} />
                </div>
              </>
            ) : null}
            <div className="mt-[1.125rem] flex items-center justify-between gap-4">
              <div className="tk-timer" dir="ltr" role="timer">
                {units.map((label, i) => (
                  <span key={label}>
                    <b>{clock ? pad(clock[i]) : "--"}</b>
                    <small>{label}</small>
                  </span>
                ))}
              </div>
              <StoreLink href={href} className="tk-btn tk-btn-cyan">
                {props.button_label}
              </StoreLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. products with tabs, and a product list ---------- */

function ProductTabs({ id, props }: { id: string; props: TeknoTabsProps }) {
  const { data } = useTekno();
  const [tab, setTab] = React.useState(0);
  const current = Math.min(tab, props.tabs.length - 1);
  const products = data.products[`${id}:${current}`] ?? [];
  return (
    <section className="tk-section">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-[1.375rem]">
        <Head
          kicker={props.kicker}
          title={props.title}
          text={props.description}
          end={
            props.tabs.length > 1 ? (
              <div className="tk-tabs" role="tablist">
                {props.tabs.map((x, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === current} onClick={() => setTab(i)} className="tk-tab as-sm">
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
  const { data } = useTekno();
  const products = data.products[id] ?? [];
  const all = props.show_view_all ? (data.view_all[id] ?? null) : null;
  return (
    <section className="tk-section">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-[1.375rem]">
        <Head title={props.title} text={props.description} end={all ? <StoreLink href={all} className="tk-more">{t.viewAll}</StoreLink> : null} />
        {products.length === 0 ? (
          <Empty text={t.empty.products} />
        ) : props.layout === "slider" ? (
          <ul className="tk-slider">
            {products.map((p) => (
              <li key={p.id}>
                <TeknoCard product={p} />
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

/* ---------- 6. banners ---------- */

function Banners({ id, props }: { id: string; props: BannersProps }) {
  const { data } = useTekno();
  const image = useImage();
  if (!props.items.length) return <Empty text={t.empty.banners} />;
  return (
    <section className="tk-section">
      <ul className={cn("tk-wrap grid gap-3.5", props.items.length > 1 && "@3xl:grid-cols-2", props.items.length > 2 && "@5xl:grid-cols-3")}>
        {props.items.map((item, i) => (
          <li key={i} className="relative overflow-hidden rounded-[1.125rem]">
            <StoreLink href={data.links[`${id}:${i}`] ?? null} className="group block">
              <Photo urls={image(item.media_id)} alt={item.title ?? ""} className="aspect-[16/9] w-full transition duration-500 group-hover:scale-105" />
              {item.title || item.kicker || item.button_label ? (
                <span className="absolute inset-0 flex flex-col justify-end gap-1 bg-linear-to-t from-[#0b1220]/75 to-transparent p-5 text-white">
                  {item.kicker ? <span className="tk-kicker !text-(--as-secondary)">{item.kicker}</span> : null}
                  {item.title ? <b className="tk-display as-xl">{item.title}</b> : null}
                  {item.button_label ? <span className="as-sm mt-1 w-fit font-extrabold text-(--as-secondary)">{item.button_label} ←</span> : null}
                </span>
              ) : null}
            </StoreLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 7. an offer with a countdown ---------- */

function Countdown({ id, props }: { id: string; props: CountdownProps }) {
  const { data, mode } = useTekno();
  const image = useImage()(props.media_id);
  const left = timeLeft(props.ends_at, useNow(mode !== "builder"));
  if (left?.ended && props.on_end === "hide" && mode !== "builder") return null;
  const parts = left ? [left.days, left.hours, left.minutes, left.seconds] : null;
  const labels = [t.countdown.days, t.countdown.hours, t.countdown.minutes, t.countdown.seconds];
  return (
    <section className="tk-section">
      <div className="tk-wrap">
        <div className={cn("tk-deal grid items-center gap-6 p-5 @3xl:p-[2.125rem]", image && "@3xl:grid-cols-[1fr_1.3fr]")}>
          {image ? <Photo urls={image} className="aspect-[4/3] w-full rounded-[1.25rem] @3xl:h-[18.75rem]" /> : null}
          <div className="flex flex-col gap-3">
            {props.kicker ? <span className="tk-kicker !text-(--tk-deal)">{props.kicker}</span> : null}
            <h2 className="tk-display tk-title">{props.title}</h2>
            {props.text ? <p className="as-sm text-slate-300">{props.text}</p> : null}
            {left?.ended ? (
              <p className="tk-display as-xl">{t.countdown.ended}</p>
            ) : (
              <div className="tk-timer" dir="ltr" role="timer">
                {labels.map((label, i) => (
                  <span key={label}>
                    <b>{parts ? pad(parts[i]) : "--"}</b>
                    <small>{label}</small>
                  </span>
                ))}
              </div>
            )}
            {props.button_label && !left?.ended ? (
              <StoreLink href={data.links[id] ?? null} className="tk-btn tk-btn-cyan mt-2 w-fit">
                {props.button_label}
              </StoreLink>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. a video ---------- */

function Video({ props }: { props: VideoProps }) {
  const { mode } = useTekno();
  const cover = useImage()(props.cover_media_id);
  const [playing, setPlaying] = React.useState(false);
  const embed = embedUrl(props.url);
  const poster = pick(cover, "large") ?? youtubePoster(props.url);
  return (
    <section className="tk-section">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-[1.375rem]">
        <Head title={props.title} text={props.text} />
        <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[1.375rem] bg-black shadow-xl">
          {playing && embed ? (
            <iframe src={embed} title={props.title ?? t.video.play} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
          ) : (
            <button type="button" onClick={() => mode !== "builder" && setPlaying(true)} className="group absolute inset-0" aria-label={t.video.play}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the merchant's cover or the video's own poster */}
              {poster ? <img src={poster} alt="" className="size-full object-cover opacity-90" /> : null}
              <span className="absolute inset-0 m-auto flex size-18 items-center justify-center rounded-full bg-(--as-secondary) text-(--as-on-secondary) shadow-2xl transition group-hover:scale-110">
                <Play className="size-7 fill-current" aria-hidden />
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 9. brands: logos or names ---------- */

function Brands({ id, props }: { id: string; props: BrandsProps }) {
  const { data } = useTekno();
  const image = useImage();
  if (!props.items.length) return <Empty text={t.empty.brands} />;
  return (
    <section className="tk-section @3xl:pt-2.5">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-5">
        <Head title={props.title} />
        <ul className="grid grid-cols-3 gap-2.5 @3xl:grid-cols-8 @3xl:gap-3">
          {props.items.map((item, i) => (
            <li key={i}>
              <StoreLink href={data.links[`${id}:${i}`] ?? null} className="tk-brand" aria-label={item.name ?? undefined}>
                {item.media_id ? <Photo urls={image(item.media_id)} size="thumb" alt={item.name ?? ""} className="max-h-full max-w-full object-contain" /> : <span className="truncate">{item.name}</span>}
              </StoreLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 10. «الضمان وخدمة ما بعد البيع» ---------- */

function Services({ props }: { props: ServicesProps }) {
  return (
    <section className="tk-section @3xl:pt-2.5">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-5">
        <Head title={props.title} />
        <ul className="grid grid-cols-2 gap-2.5 @3xl:grid-cols-4 @3xl:gap-3.5">
          {props.items.map((item, i) => {
            const Icon = TECH_ICONS[item.icon] ?? Star;
            return (
              <li key={i} className="tk-card flex flex-col gap-2 p-3.5 @3xl:p-[1.125rem]">
                <span className="tk-service-icon">
                  <Icon className="size-5" aria-hidden />
                </span>
                <b className="as-sm @3xl:as-base">{item.title}</b>
                {item.text ? <p className="as-xs @3xl:as-sm as-muted leading-relaxed">{item.text}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 11. reviews ---------- */

function Testimonials({ props }: { props: TeknoTestimonialsProps }) {
  const { data } = useTekno();
  const items = props.source === "auto" ? data.reviews.map((r) => ({ name: r.name, rating: r.rating, text: r.text, product: r.product?.name ?? null })) : props.items;
  if (!items.length) return null;
  return (
    <section className="tk-section @3xl:pt-2.5">
      <div className="tk-wrap flex flex-col gap-4 @3xl:gap-5">
        <Head title={props.title} />
        <ul className="tk-row-scroll @3xl:grid @3xl:grid-cols-4 @3xl:gap-3.5">
          {items.slice(0, 8).map((r, i) => (
            <li key={i} className="tk-card as-sm flex w-[78%] shrink-0 flex-col gap-2 p-4 @3xl:w-auto">
              <Stars value={r.rating} className="[&_svg]:size-3.5" />
              <p className="leading-relaxed">{r.text}</p>
              {r.product ? <span className="tk-bought w-fit">{t.bought(r.product)}</span> : null}
              <b className="mt-auto pt-1">{r.name}</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 12. questions ---------- */

function Faq({ props }: { props: FaqProps }) {
  const { settings } = useTekno();
  const [open, setOpen] = React.useState<number | null>(0);
  const wa = props.whatsapp_button && settings.footer.whatsapp ? whatsappLink(settings.footer.whatsapp) : null;
  return (
    <section className="tk-section">
      <div className="tk-wrap grid gap-6 @3xl:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-3">
          {props.title ? <h2 className="tk-display tk-title">{props.title}</h2> : null}
          {props.text ? <p className="as-sm as-muted leading-relaxed">{props.text}</p> : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="tk-btn tk-btn-main as-sm mt-1 w-fit">
              {t.faq.whatsapp}
            </a>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2.5">
          {props.items.map((item, i) => (
            <li key={i} className="tk-qa tk-card" data-open={open === i ? "" : undefined}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="as-sm flex w-full items-center justify-between gap-3 p-4 text-start font-extrabold" aria-expanded={open === i}>
                {item.question}
                <ChevronDown className={cn("size-5 shrink-0 transition", open === i && "rotate-180")} aria-hidden />
              </button>
              <div className="tk-qa-body">
                <div>
                  <p className="as-sm as-muted whitespace-pre-line px-4 pb-4 leading-relaxed">{item.answer}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 13. a WhatsApp (or link) band ---------- */

function Cta({ id, props }: { id: string; props: CtaProps }) {
  const { settings, data, mode } = useTekno();
  const number = settings.footer.whatsapp;
  const href = props.action === "whatsapp" ? (number ? whatsappLink(number, props.message ?? undefined) : null) : (data.links[id] ?? null);
  const button = "tk-btn tk-btn-cyan shrink-0";
  return (
    <section className="tk-section">
      <div className="tk-wrap">
        <div className="flex flex-col items-start gap-4 rounded-[1.5rem] bg-(--as-primary) p-6 text-(--as-on-primary) @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:p-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="tk-display tk-title">{props.title}</h2>
            {props.text ? <p className="as-sm opacity-85">{props.text}</p> : null}
          </div>
          {href ? (
            props.action === "whatsapp" ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className={button}>
                {props.button_label}
              </a>
            ) : (
              <StoreLink href={href} className={button}>
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

/** One home section of «تيكنو». */
export function SectionView({ section }: { section: TeknoSection }) {
  const id = section.id;
  switch (section.type) {
    case "tech_hero":
      return <TechHero id={id} props={section.props} />;
    case "features":
      return <Trust props={section.props} />;
    case "categories":
      return <Categories id={id} props={section.props} />;
    case "deal_of_day":
      return <DealOfDay id={id} props={section.props} />;
    case "product_tabs":
      return <ProductTabs id={id} props={section.props} />;
    case "products":
      return <Products id={id} props={section.props} />;
    case "banners":
      return <Banners id={id} props={section.props} />;
    case "countdown":
      return <Countdown id={id} props={section.props} />;
    case "video":
      return <Video props={section.props} />;
    case "brands":
      return <Brands id={id} props={section.props} />;
    case "services":
      return <Services props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "cta":
      return <Cta id={id} props={section.props} />;
    case "ai":
      return <StoreAiSection section={section} themeKey="tekno_store" />;
  }
}
