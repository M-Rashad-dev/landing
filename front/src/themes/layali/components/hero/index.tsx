import { Sparkle } from "lucide-react";
import { bestUnitOffer } from "@/lib/price/offers";
import { HeroPicture } from "@/themes/shared/components/hero-picture";
import { Price } from "@/themes/shared/components/price";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { HeroProps } from "@/themes/shared/schemas";
import type { PageContext, SectionProps } from "@/themes/types";
import { mediaOf, nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const HEIGHTS: Record<HeroProps["min_height"], string> = { sm: "min-h-[420px]", md: "min-h-[600px]", lg: "min-h-[720px]", screen: "min-h-[100svh]" };

function Text({ props, ctx, center }: { props: HeroProps; ctx: PageContext; center: boolean }) {
  const product = ctx.product;
  const offer = product ? bestUnitOffer(ctx.offers, product) : null;
  const badges = nonEmpty<{ text: string }>(props.badges, "text");
  return (
    <div className={cn("flex flex-col gap-6", center ? "items-center text-center" : "items-start text-start")}>
      {props.eyebrow ? <span className="l-eyebrow">{props.eyebrow}</span> : null}
      {props.title ? <h1 className="t-heading l-grad-text text-4xl font-bold leading-[1.15] sm:text-5xl md:text-6xl">{props.title}</h1> : null}
      {props.subtitle ? <p className="t-muted max-w-xl text-base leading-loose sm:text-lg">{props.subtitle}</p> : null}
      {props.show_price && product ? (
        <Price
          price={offer ? offer.total : product.price}
          compareAt={offer ? product.price : product.compare_at_price}
          showBadge
          badgeText={offer ? offer.offer.badge_text || ar.site.savePercent(offer.savingsPercent) : null}
          className={center ? "justify-center" : undefined}
          priceClassName="text-3xl"
          compareClassName="text-lg"
          badgeClassName="rounded-full"
        />
      ) : null}
      <div className={cn("flex flex-wrap gap-3", center && "justify-center")}>
        {props.cta_label ? (
          <SafeLink href={props.cta_url || "#order"} className="t-primary t-btn l-glow-btn inline-flex min-h-14 items-center justify-center px-10 text-base font-bold">
            {props.cta_label}
          </SafeLink>
        ) : null}
        {props.secondary_cta_label && props.secondary_cta_url ? (
          <SafeLink href={props.secondary_cta_url} className="l-glass t-btn inline-flex min-h-14 items-center justify-center px-7 text-base font-semibold">
            {props.secondary_cta_label}
          </SafeLink>
        ) : null}
      </div>
      {badges.length ? (
        <ul className={cn("flex flex-wrap gap-2", center && "justify-center")}>
          {badges.map((badge, i) => (
            <li key={i} className="l-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium sm:text-sm">
              <Sparkle className="size-3.5 text-[var(--c-accent)]" aria-hidden />
              {badge.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * «ليالي» hero: "glow-center" puts the product on a glowing halo under huge gradient type;
 * "split-glass" sets the text beside the photo in a glass frame. Both sit on a slow aurora.
 */
export function LayaliHero({ props, variant, ctx }: SectionProps<HeroProps>) {
  const image = mediaOf(ctx, props.image_media_id) ?? ctx.product?.images[0] ?? null;
  const mobile = mediaOf(ctx, props.mobile_image_media_id);

  if (variant === "split-glass") {
    return (
      <section className={cn("relative flex items-center overflow-hidden", HEIGHTS[props.min_height] ?? HEIGHTS.md)}>
        <div className="l-aurora" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.1fr_1fr]">
          <Text props={props} ctx={ctx} center={props.text_align === "center"} />
          {image ? (
            <div className="l-glass mx-auto w-full max-w-md rotate-[-2deg] rounded-[2.25rem] p-3 transition-transform duration-500 hover:rotate-0 md:max-w-none">
              <HeroPicture desktop={image} mobile={mobile} sizes="(min-width: 768px) 45vw, 100vw" className="aspect-[4/5] w-full rounded-[1.75rem] object-cover" />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("relative flex items-center overflow-hidden", HEIGHTS[props.min_height] ?? HEIGHTS.md)}>
      <div className="l-aurora" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-12 px-4 py-16">
        <Text props={props} ctx={ctx} center />
        {image ? (
          <div className="l-ring w-full max-w-sm">
            <HeroPicture desktop={image} mobile={mobile} sizes="(min-width: 768px) 384px, 80vw" className="aspect-square w-full rounded-full object-cover ring-1 ring-white/15 shadow-[0_40px_100px_-40px_var(--c-primary)]" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
