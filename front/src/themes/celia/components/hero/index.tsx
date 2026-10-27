import { ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/price";
import { bestUnitOffer } from "@/lib/price/offers";
import { HeroPicture } from "@/themes/shared/components/hero-picture";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { HeroProps } from "@/themes/shared/schemas";
import type { PageContext, SectionProps } from "@/themes/types";
import { mediaOf, nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const HEIGHTS: Record<HeroProps["min_height"], string> = { sm: "min-h-[380px]", md: "min-h-[560px]", lg: "min-h-[720px]", screen: "min-h-[100svh]" };

/** The price as a slanted tag (old price struck, offer badge). */
function PriceTag({ ctx, className }: { ctx: PageContext; className?: string }) {
  const product = ctx.product;
  if (!product) return null;
  const offer = bestUnitOffer(ctx.offers, product);
  const price = offer ? offer.total : product.price;
  const old = offer ? product.price : product.compare_at_price;
  return (
    <div className={cn("inline-flex -rotate-2 flex-wrap items-baseline gap-3 bg-[var(--c-fg)] px-4 py-2 text-[var(--c-bg)]", className)}>
      <span className="text-3xl font-black tabular-nums">{formatPrice(price)}</span>
      {old && old > price ? <del className="tabular-nums opacity-70">{formatPrice(old)}</del> : null}
      {offer ? <span className="t-accent px-2 py-0.5 text-xs font-extrabold">{offer.offer.badge_text || ar.site.savePercent(offer.savingsPercent)}</span> : null}
    </div>
  );
}

function Buttons({ props, center }: { props: HeroProps; center?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-4", center && "justify-center")}>
      {props.cta_label ? (
        <SafeLink href={props.cta_url || "#order"} className="t-primary t-btn t-hard t-press inline-flex min-h-14 items-center gap-2 px-8 text-lg font-extrabold">
          {props.cta_label}
          <ArrowLeft className="size-5" aria-hidden />
        </SafeLink>
      ) : null}
      {props.secondary_cta_label && props.secondary_cta_url ? (
        <SafeLink href={props.secondary_cta_url} className="t-bg t-btn t-hard t-press inline-flex min-h-14 items-center px-6 font-bold">
          {props.secondary_cta_label}
        </SafeLink>
      ) : null}
    </div>
  );
}

function BadgeStrip({ props }: { props: HeroProps }) {
  const badges = nonEmpty<{ text: string }>(props.badges, "text");
  if (!badges.length) return null;
  return (
    <ul className="flex flex-wrap border-y-2 t-line">
      {badges.map((badge, i) => (
        <li key={i} className={cn("flex-1 whitespace-nowrap px-4 py-3 text-center text-sm font-extrabold uppercase", i > 0 && "border-s-2 t-line")}>
          {badge.text}
        </li>
      ))}
    </ul>
  );
}

export function CeliaHero({ props, variant, ctx }: SectionProps<HeroProps>) {
  const image = mediaOf(ctx, props.image_media_id) ?? ctx.product?.images[0] ?? null;
  const mobile = mediaOf(ctx, props.mobile_image_media_id);
  const center = props.text_align === "center";
  const eyebrow = props.eyebrow ? <span className="t-accent inline-block border-2 t-line px-3 py-1 text-xs font-extrabold uppercase">{props.eyebrow}</span> : null;

  if (variant === "full-cover" && image) {
    return (
      <section className={cn("relative flex items-end overflow-hidden bg-black text-white", HEIGHTS[props.min_height] ?? HEIGHTS.md)}>
        <HeroPicture desktop={image} mobile={mobile} sizes="100vw" className="absolute inset-0 h-full w-full object-cover grayscale-[20%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" style={{ opacity: Math.max(0.35, Math.min(80, props.overlay_opacity ?? 40) / 80) }} aria-hidden />
        <div className={cn("relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-24", center && "items-center text-center")}>
          {eyebrow}
          {props.title ? <h1 className="t-heading text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">{props.title}</h1> : null}
          {props.subtitle ? <p className="max-w-2xl text-lg text-white/85">{props.subtitle}</p> : null}
          {props.show_price ? <PriceTag ctx={ctx} className="bg-white text-black" /> : null}
          <Buttons props={props} center={center} />
        </div>
      </section>
    );
  }

  if (variant === "split-reverse") {
    return (
      <section className="t-bg">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
          {image ? (
            <div className="t-hard relative">
              <HeroPicture desktop={image} mobile={mobile} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] w-full object-cover" />
            </div>
          ) : null}
          <div className={cn("flex flex-col gap-6", center && "items-center text-center")}>
            {eyebrow}
            {props.title ? <h1 className="t-heading text-4xl font-black leading-tight tracking-tight md:text-5xl">{props.title}</h1> : null}
            {props.subtitle ? <p className="t-muted text-lg leading-relaxed">{props.subtitle}</p> : null}
            {props.show_price ? <PriceTag ctx={ctx} /> : null}
            <Buttons props={props} center={center} />
          </div>
        </div>
        <BadgeStrip props={props} />
      </section>
    );
  }

  // big-type (default)
  return (
    <section className={cn("t-bg t-stripes overflow-hidden", props.min_height === "screen" && "min-h-[100svh]")}>
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 md:pb-16 md:pt-14">
        <div className={cn("flex flex-col gap-5", center && "items-center text-center")}>
          {eyebrow}
          {props.title ? <h1 className="t-heading text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">{props.title}</h1> : null}
        </div>
        <div className="mt-10 grid items-end gap-10 md:grid-cols-[1fr_1.1fr]">
          <div className={cn("flex flex-col gap-6", center && "items-center text-center")}>
            {props.subtitle ? <p className="t-muted text-lg leading-relaxed">{props.subtitle}</p> : null}
            {props.show_price ? <PriceTag ctx={ctx} /> : null}
            <Buttons props={props} center={center} />
            <BadgeStrip props={props} />
          </div>
          {image ? (
            <div className="t-hard relative md:rotate-1">
              <HeroPicture desktop={image} mobile={mobile} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[4/3] w-full object-cover" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
