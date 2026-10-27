import { CheckCircle2 } from "lucide-react";
import { bestUnitOffer } from "@/lib/price/offers";
import { Price } from "@/themes/shared/components/price";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { HeroProps } from "@/themes/shared/schemas";
import type { PageContext, PublicImage, SectionProps } from "@/themes/types";
import { mediaOf, nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const HEIGHTS: Record<HeroProps["min_height"], string> = { sm: "min-h-[360px]", md: "min-h-[520px]", lg: "min-h-[680px]", screen: "min-h-[100svh]" };

/** Desktop image + optional mobile image (art direction via <picture>). */
function HeroPicture({ desktop, mobile, className, sizes }: { desktop: PublicImage; mobile: PublicImage | null; className?: string; sizes: string }) {
  return (
    <picture>
      {mobile ? <source media="(max-width: 767px)" srcSet={`${mobile.urls.medium} 800w, ${mobile.urls.large} 1600w`} sizes="100vw" /> : null}
      <img
        src={desktop.urls.large}
        srcSet={`${desktop.urls.medium} 800w, ${desktop.urls.large} 1600w`}
        sizes={sizes}
        width={desktop.width}
        height={desktop.height}
        alt={desktop.alt ?? ""}
        fetchPriority="high"
        loading="eager"
        className={className}
      />
    </picture>
  );
}

function HeroText({ props, ctx, center, inverted }: { props: HeroProps; ctx: PageContext; center: boolean; inverted?: boolean }) {
  const product = ctx.product;
  const offer = product ? bestUnitOffer(ctx.offers, product) : null;
  const badges = nonEmpty<{ text: string }>(props.badges, "text");
  return (
    <div className={cn("flex flex-col gap-5", center ? "items-center text-center" : "items-start text-start")}>
      {props.eyebrow ? <span className={cn("rounded-full px-4 py-1.5 text-xs font-bold", inverted ? "bg-white/20 text-white" : "t-tint-strong t-primary-text")}>{props.eyebrow}</span> : null}
      {props.title ? <h1 className="t-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{props.title}</h1> : null}
      {props.subtitle ? <p className={cn("max-w-xl text-base leading-relaxed sm:text-lg", inverted ? "text-white/85" : "t-muted")}>{props.subtitle}</p> : null}
      {props.show_price && product ? (
        <Price
          price={offer ? offer.total : product.price}
          compareAt={offer ? product.price : product.compare_at_price}
          showBadge
          badgeText={offer ? offer.offer.badge_text || ar.site.savePercent(offer.savingsPercent) : null}
          priceClassName="text-3xl"
          compareClassName="text-lg"
          inverted={inverted}
          badgeClassName="rounded-full"
        />
      ) : null}
      <div className={cn("flex flex-wrap gap-3", center && "justify-center")}>
        {props.cta_label ? (
          <SafeLink href={props.cta_url || "#order"} className="t-primary t-btn inline-flex min-h-12 items-center justify-center px-8 text-base font-bold shadow-[0_8px_24px_rgba(0,0,0,.12)] transition-transform hover:-translate-y-0.5">
            {props.cta_label}
          </SafeLink>
        ) : null}
        {props.secondary_cta_label && props.secondary_cta_url ? (
          <SafeLink href={props.secondary_cta_url} className={cn("t-btn inline-flex min-h-12 items-center justify-center border px-6 text-base font-semibold", inverted ? "border-white/60 text-white" : "t-border")}>
            {props.secondary_cta_label}
          </SafeLink>
        ) : null}
      </div>
      {badges.length ? (
        <ul className={cn("flex flex-wrap gap-x-5 gap-y-2", center && "justify-center")}>
          {badges.map((badge, i) => (
            <li key={i} className={cn("flex items-center gap-1.5 text-sm font-medium", inverted ? "text-white/90" : "")}>
              <CheckCircle2 className={cn("size-4", inverted ? "text-white" : "t-primary-text")} aria-hidden />
              {badge.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MalakHero({ props, variant, ctx }: SectionProps<HeroProps>) {
  const image = mediaOf(ctx, props.image_media_id) ?? ctx.product?.images[0] ?? null;
  const mobile = mediaOf(ctx, props.mobile_image_media_id);
  const center = props.text_align === "center";

  if (variant === "full-cover" && image) {
    return (
      <section className={cn("relative flex items-center overflow-hidden", HEIGHTS[props.min_height] ?? HEIGHTS.md)}>
        <HeroPicture desktop={image} mobile={mobile} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black" style={{ opacity: Math.min(80, Math.max(0, props.overlay_opacity ?? 40)) / 100 }} aria-hidden />
        <div className={cn("relative mx-auto w-full max-w-6xl px-4 py-16 text-white", center && "flex justify-center")}>
          <div className="max-w-2xl">
            <HeroText props={props} ctx={ctx} center={center} inverted />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "centered-card") {
    return (
      <section className={cn("relative flex items-center justify-center overflow-hidden px-4 py-16", HEIGHTS[props.min_height] ?? HEIGHTS.md)}>
        {image ? (
          <>
            <HeroPicture desktop={image} mobile={mobile} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black" style={{ opacity: Math.min(80, props.overlay_opacity ?? 40) / 100 }} aria-hidden />
          </>
        ) : (
          <div className="t-tint absolute inset-0" aria-hidden>
            <div className="absolute -start-20 -top-20 size-72 rounded-full opacity-40" style={{ background: "var(--c-secondary)" }} />
            <div className="absolute -bottom-24 -end-16 size-80 rounded-full opacity-30" style={{ background: "var(--c-primary)" }} />
          </div>
        )}
        <div className="t-bg t-fade-up relative w-full max-w-2xl rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,.12)] sm:p-12">
          <HeroText props={props} ctx={ctx} center />
        </div>
      </section>
    );
  }

  // split (default)
  return (
    <section className="t-tint relative overflow-hidden">
      <div className="absolute -end-24 -top-24 size-96 rounded-full opacity-30 blur-2xl" style={{ background: "var(--c-secondary)" }} aria-hidden />
      <div className={cn("relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20", props.min_height === "screen" && "min-h-[100svh]", props.min_height === "lg" && "md:min-h-[640px]")}>
        <HeroText props={props} ctx={ctx} center={center} />
        {image ? (
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="absolute inset-4 -z-0 rounded-[2.5rem] opacity-60" style={{ background: "var(--c-secondary)" }} aria-hidden />
            <HeroPicture desktop={image} mobile={mobile} sizes="(min-width: 768px) 50vw, 100vw" className="relative aspect-square w-full rounded-[2.5rem] object-cover shadow-[0_8px_30px_rgba(0,0,0,.08)]" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
