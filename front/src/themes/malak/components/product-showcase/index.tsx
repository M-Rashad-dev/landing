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

function Details({ props, ctx, product, center, onTint }: { props: ProductShowcaseProps; ctx: PageContext; product: PublicProduct; center?: boolean; onTint?: boolean }) {
  const offer = bestUnitOffer(ctx.offers, product);
  const description = props.description_override?.trim() || product.description || "";
  const highlights = nonEmpty<{ icon: string; text: string }>(props.highlights, "text");
  return (
    <div className={cn("flex flex-col gap-5", center && "items-center text-center")}>
      <h2 className="t-heading text-2xl font-bold md:text-3xl">{props.title_override?.trim() || product.name}</h2>
      {props.show_price ? (
        <Price
          price={offer ? offer.total : product.price}
          compareAt={offer ? product.price : product.compare_at_price}
          showCompare={props.show_compare_price}
          showBadge={props.show_discount_badge}
          badgeText={offer ? offer.offer.badge_text || ar.site.savePercent(offer.savingsPercent) : null}
          className={center ? "justify-center" : undefined}
          priceClassName="text-3xl t-primary-text"
          compareClassName="text-lg"
          badgeClassName="rounded-full"
        />
      ) : null}
      {props.show_description && description ? (
        <Markdown className="t-muted max-w-prose text-start leading-loose [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_strong]:text-[var(--c-fg)] [&_ul]:list-disc [&_ul]:ps-5">{description}</Markdown>
      ) : null}
      {highlights.length ? (
        <ul className="grid w-full gap-3 sm:grid-cols-2">
          {highlights.map((item, i) => (
            <li key={i} className={cn("flex items-center gap-3 rounded-2xl p-3 text-start text-sm font-medium", onTint ? "t-bg shadow-sm" : "t-tint")}>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", onTint ? "t-tint" : "t-bg")}>
                <IconView name={item.icon} className="size-4 t-primary-text" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      ) : null}
      {props.cta_label ? (
        <SafeLink href={props.cta_url || "#order"} className="t-primary t-btn inline-flex min-h-12 items-center justify-center px-8 font-bold shadow-sm">
          {props.cta_label}
        </SafeLink>
      ) : null}
    </div>
  );
}

export function MalakProductShowcase({ props, variant, ctx }: SectionProps<ProductShowcaseProps>) {
  const product = ctx.product;
  if (!product) return <PreviewEmpty ctx={ctx} label={ar.builder.noProductNotice} />;
  const image = product.images[0];

  if (variant === "side-by-side") {
    return (
      <section className="t-tint px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          {image ? <ResponsiveImage image={image} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-square w-full rounded-3xl object-cover shadow-[0_8px_30px_rgba(0,0,0,.06)]" /> : null}
          <Details props={props} ctx={ctx} product={product} onTint />
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="t-bg mx-auto max-w-3xl rounded-3xl border t-border p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)] sm:p-10">
        {image ? <ResponsiveImage image={image} sizes="(min-width: 768px) 640px, 100vw" className="mx-auto mb-8 aspect-[4/3] w-full rounded-2xl object-cover" /> : null}
        <Details props={props} ctx={ctx} product={product} center />
      </div>
    </section>
  );
}
