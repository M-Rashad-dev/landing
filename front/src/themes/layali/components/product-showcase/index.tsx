import { Markdown } from "@/components/shared/markdown";
import { bestUnitOffer } from "@/lib/price/offers";
import { IconView } from "@/themes/shared/icon-view";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import { Price } from "@/themes/shared/components/price";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { ProductShowcaseProps } from "@/themes/shared/schemas";
import type { PageContext, PublicProduct, SectionProps } from "@/themes/types";
import { nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

function Details({ props, ctx, product, center }: { props: ProductShowcaseProps; ctx: PageContext; product: PublicProduct; center?: boolean }) {
  const offer = bestUnitOffer(ctx.offers, product);
  const description = props.description_override?.trim() || product.description || "";
  const highlights = nonEmpty<{ icon: string; text: string }>(props.highlights, "text");
  return (
    <div className={cn("flex flex-col gap-6", center && "items-center text-center")}>
      <h2 className="t-heading l-grad-text text-3xl font-bold leading-tight md:text-4xl">{props.title_override?.trim() || product.name}</h2>
      {props.show_price ? (
        <Price
          price={offer ? offer.total : product.price}
          compareAt={offer ? product.price : product.compare_at_price}
          showCompare={props.show_compare_price}
          showBadge={props.show_discount_badge}
          badgeText={offer ? offer.offer.badge_text || ar.site.savePercent(offer.savingsPercent) : null}
          className={center ? "justify-center" : undefined}
          priceClassName="text-3xl"
          compareClassName="text-lg"
          badgeClassName="rounded-full"
        />
      ) : null}
      {props.show_description && description ? (
        <Markdown className="t-muted max-w-prose text-start leading-loose [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_strong]:text-[var(--c-fg)] [&_ul]:list-disc [&_ul]:ps-5">{description}</Markdown>
      ) : null}
      {highlights.length ? (
        <ul data-reveal-stagger className="grid w-full gap-3 sm:grid-cols-2">
          {highlights.map((item, i) => (
            <li key={i} className="l-glass flex items-center gap-3 rounded-2xl p-3.5 text-start text-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, var(--c-primary), var(--c-accent))", color: "var(--c-primary-fg)" }}>
                <IconView name={item.icon} className="size-4" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      ) : null}
      {props.cta_label ? (
        <SafeLink href={props.cta_url || "#order"} className="t-primary t-btn l-glow-btn inline-flex min-h-14 items-center justify-center px-10 font-bold">
          {props.cta_label}
        </SafeLink>
      ) : null}
    </div>
  );
}

/** «ليالي» product: "luxe-split" (photo on a glowing plinth beside the details) or "center-stage". */
export function LayaliProductShowcase({ props, variant, ctx }: SectionProps<ProductShowcaseProps>) {
  const product = ctx.product;
  if (!product) return <PreviewEmpty ctx={ctx} label={ar.builder.noProductNotice} />;
  const image = product.images[0];

  if (variant === "center-stage") {
    return (
      <section className="relative px-4 py-20 md:py-28">
        <div className="l-glass mx-auto flex max-w-3xl flex-col items-center gap-10 rounded-[2.25rem] p-6 sm:p-12">
          {image ? (
            <div className="l-ring w-full max-w-md">
              <ResponsiveImage image={image} sizes="(min-width: 768px) 448px, 90vw" className="aspect-square w-full rounded-[1.75rem] object-cover" />
            </div>
          ) : null}
          <Details props={props} ctx={ctx} product={product} center />
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        {image ? (
          <div className="relative">
            <div className="l-ring">
              <ResponsiveImage image={image} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-square w-full rounded-[2rem] object-cover ring-1 ring-white/10" />
            </div>
            <div className="mx-auto -mt-6 h-6 w-3/4 rounded-[50%] opacity-60 blur-xl" style={{ background: "var(--c-primary)" }} aria-hidden />
          </div>
        ) : null}
        <Details props={props} ctx={ctx} product={product} />
      </div>
    </section>
  );
}
