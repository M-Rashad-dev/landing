import { Markdown } from "@/components/shared/markdown";
import { discountPercent, formatPrice } from "@/lib/price";
import { bestUnitOffer } from "@/lib/price/offers";
import { IconView } from "@/themes/shared/icon-view";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { ProductShowcaseProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export function CeliaProductShowcase({ props, variant, ctx }: SectionProps<ProductShowcaseProps>) {
  const product = ctx.product;
  if (!product) return <PreviewEmpty ctx={ctx} label={ar.builder.noProductNotice} />;
  const offer = bestUnitOffer(ctx.offers, product);
  const price = offer ? offer.total : product.price;
  const old = offer ? product.price : product.compare_at_price;
  const percent = offer ? offer.savingsPercent : discountPercent(price, old);
  const description = props.description_override?.trim() || product.description || "";
  const highlights = nonEmpty<{ icon: string; text: string }>(props.highlights, "text");
  const image = product.images[0];
  const title = props.title_override?.trim() || product.name;

  const priceBlock = props.show_price ? (
    <div className="flex flex-wrap items-end gap-4">
      <span className="text-5xl font-black tabular-nums tracking-tight md:text-6xl">{formatPrice(price)}</span>
      {props.show_compare_price && old && old > price ? <del className="pb-2 text-xl tabular-nums opacity-60">{formatPrice(old)}</del> : null}
      {props.show_discount_badge && percent ? <span className="t-accent mb-2 border-2 t-line px-2 py-0.5 text-sm font-black">-{percent}%</span> : null}
    </div>
  ) : null;

  const desc =
    props.show_description && description ? (
      <Markdown className="leading-loose opacity-80 [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ps-5">{description}</Markdown>
    ) : null;

  const list = highlights.length ? (
    <ul className="border-t-2 t-line">
      {highlights.map((item, i) => (
        <li key={i} className="flex items-center gap-3 border-b-2 t-line py-3 font-bold">
          <IconView name={item.icon} className="size-5 shrink-0" />
          {item.text}
        </li>
      ))}
    </ul>
  ) : null;

  const cta = props.cta_label ? (
    <SafeLink href={props.cta_url || "#order"} className="t-primary t-btn t-hard t-press inline-flex min-h-14 items-center justify-center px-8 text-lg font-extrabold">
      {props.cta_label}
    </SafeLink>
  ) : null;

  if (variant === "stacked") {
    return (
      <section className="t-bg border-t-[3px] t-line">
        <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
          <h2 className="t-heading mb-8 text-4xl font-black leading-tight tracking-tight md:text-6xl">{title}</h2>
          {image ? <ResponsiveImage image={image} sizes="(min-width: 896px) 896px, 100vw" className="t-hard mb-8 aspect-[16/10] w-full object-cover" /> : null}
          <div className="flex flex-col gap-6">
            {desc}
            {list}
          </div>
        </div>
        {priceBlock || cta ? (
          <div className="t-inverse">
            <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between">
              {priceBlock}
              {cta}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
      <div className={cn("mx-auto grid max-w-6xl gap-10", image && "md:grid-cols-2")}>
        {image ? <ResponsiveImage image={image} sizes="(min-width: 768px) 50vw, 100vw" className="t-hard aspect-square w-full object-cover" /> : null}
        <div className="flex flex-col gap-6">
          <h2 className="t-heading text-4xl font-black leading-tight tracking-tight md:text-5xl">{title}</h2>
          {priceBlock}
          {desc}
          {list}
          {cta}
        </div>
      </div>
    </section>
  );
}
