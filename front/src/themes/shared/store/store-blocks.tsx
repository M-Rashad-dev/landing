import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { siteMessages } from "@/messages/site";
import { HeroPicture } from "@/themes/shared/components/hero-picture";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import { Slider } from "@/themes/shared/components/slider";
import type { BannerSliderProps, CategoryGridProps, ProductGridProps, PromoBannerProps } from "@/themes/shared/schemas";
import { LOOKS, type LookKey } from "@/themes/shared/sections/looks";
import { mediaOf } from "@/themes/shared/utils";
import type { PageContext, SectionProps, StoreCategory, StoreProductCard } from "@/themes/types";
import { descendantIds, storePaths } from "./links";
import { ProductCard } from "./product-card";

type BlockProps<P> = SectionProps<P> & { look: LookKey };

const HEIGHTS = { small: "h-56 md:h-72", medium: "h-72 md:h-[26rem]", large: "h-[26rem] md:h-[36rem]" } as const;

function Heading({ title, subtitle, look, action }: { title?: string; subtitle?: string; look: LookKey; action?: ReactNode }) {
  if (!title && !subtitle && !action) return null;
  const l = LOOKS[look];
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        {title ? <h2 className={l.heading}>{title}</h2> : null}
        {subtitle ? <p className={l.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ---------- Banner slider ---------- */

export function BannerSliderBlock({ props, variant, ctx, look }: BlockProps<BannerSliderProps>) {
  const l = LOOKS[look];
  const slides = (Array.isArray(props.slides) ? props.slides : []).map((slide) => ({ ...slide, image: mediaOf(ctx, slide.image_media_id), mobile: mediaOf(ctx, slide.mobile_image_media_id) })).filter((slide) => slide.image);
  if (slides.length === 0) return <PreviewEmpty ctx={ctx} label={ar.sections.banner_slider.empty} />;
  const height = HEIGHTS[props.height] ?? HEIGHTS.medium;
  const contained = variant === "contained";

  return (
    <section className={cn(contained ? "px-4 pt-6" : "")}>
      <div className={cn(contained ? "mx-auto max-w-6xl overflow-hidden" : "", contained && l.frame)}>
        <Slider autoplay={props.autoplay && slides.length > 1} className="relative">
          {slides.map((slide, i) => (
            <div key={i} className={cn("relative w-full overflow-hidden", height)}>
              <HeroPicture desktop={slide.image!} mobile={slide.mobile} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
              {slide.title || slide.subtitle || slide.cta_label ? (
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-6 md:items-center md:p-12">
                  <div className="max-w-xl text-white">
                    {slide.title ? <h2 className="t-heading text-2xl font-extrabold leading-tight drop-shadow md:text-4xl">{slide.title}</h2> : null}
                    {slide.subtitle ? <p className="mt-2 text-sm opacity-90 md:text-lg">{slide.subtitle}</p> : null}
                    {slide.cta_label ? (
                      <SafeLink href={ctx.isPreview ? null : slide.cta_url} className={cn(l.button, "mt-5")}>
                        {slide.cta_label}
                      </SafeLink>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </Slider>
      </div>
    </section>
  );
}

/* ---------- Category grid ---------- */

export function categoriesFor(ctx: PageContext, props: CategoryGridProps): StoreCategory[] {
  const all = ctx.store?.categories ?? [];
  const list = props.source === "children" && props.parent_id ? all.filter((c) => c.parent_id === props.parent_id) : all.filter((c) => c.parent_id === null);
  return list.slice(0, Math.max(1, Math.min(24, Number(props.limit) || 8)));
}

export function CategoryGridBlock({ props, variant, ctx, look }: BlockProps<CategoryGridProps>) {
  const l = LOOKS[look];
  const categories = categoriesFor(ctx, props);
  if (categories.length === 0) return <PreviewEmpty ctx={ctx} label={ar.sections.category_grid.empty} />;
  const circles = variant === "circles";

  return (
    <section className={l.section}>
      <div className={cn(l.container, "max-w-6xl")}>
        <Heading title={props.title} subtitle={props.subtitle} look={look} />
        <ul className={cn("grid gap-4", circles ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4")}>
          {categories.map((category) => (
            <li key={category.id}>
              <a href={ctx.isPreview ? undefined : storePaths.category(category.slug)} className="group flex flex-col items-center gap-2 text-center">
                <span className={cn("block w-full overflow-hidden", circles ? "aspect-square rounded-full" : cn("aspect-[4/3]", l.frame), "t-tint")}>
                  {category.image ? (
                    <ResponsiveImage image={category.image} sizes="(min-width: 1024px) 20vw, 40vw" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt={category.image.alt ?? category.name} />
                  ) : (
                    <span className="t-heading flex h-full items-center justify-center text-3xl font-black opacity-40">{category.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className="t-heading text-sm font-bold md:text-base">{category.name}</span>
                {props.show_count ? <span className="t-muted -mt-1 text-xs">{siteMessages.store.productsCount(category.products_count)}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Product grid ---------- */

/** Saved sections get their products from the server; in the Builder a new / changed grid uses the sample. */
export function productsFor(ctx: PageContext, sectionId: string, props: ProductGridProps): StoreProductCard[] {
  const limit = Math.max(1, Math.min(24, Number(props.limit) || 8));
  if (!ctx.isPreview) return (ctx.store?.products[sectionId] ?? []).slice(0, limit);
  let sample = ctx.store?.sample ?? [];
  if (props.source === "featured") sample = sample.filter((p) => p.is_featured);
  if (props.source === "category") {
    const ids = props.category_id ? descendantIds(ctx.store?.categories ?? [], props.category_id) : new Set<number>();
    sample = sample.filter((p) => (p.category_ids ?? []).some((id) => ids.has(id)));
  }
  return sample.slice(0, limit);
}

export function ProductGridBlock({ props, variant, ctx, look, sectionId }: BlockProps<ProductGridProps>) {
  const l = LOOKS[look];
  const products = productsFor(ctx, sectionId, props);
  if (products.length === 0) return <PreviewEmpty ctx={ctx} label={ar.sections.product_grid.empty} />;
  const category = props.source === "category" && props.category_id ? ctx.store?.categories.find((c) => c.id === props.category_id) : undefined;
  const viewAllHref = category ? storePaths.category(category.slug) : props.source === "featured" ? `${storePaths.products}?sort=featured` : props.source === "best_sellers" ? `${storePaths.products}?sort=best_sellers` : storePaths.products;
  const viewAll =
    props.show_view_all && props.view_all_label ? (
      <a href={ctx.isPreview ? undefined : viewAllHref} className="t-heading text-sm font-bold underline-offset-4 hover:underline">
        {props.view_all_label} ←
      </a>
    ) : null;

  return (
    <section className={l.section}>
      <div className={cn(l.container, "max-w-6xl")}>
        <Heading title={props.title} subtitle={props.subtitle} look={look} action={viewAll} />
        {variant === "slider" ? (
          <Slider slideClassName="basis-1/2 md:basis-1/3 lg:basis-1/4 ps-4" className="-ms-4" showDots={false}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} look={look} isPreview={ctx.isPreview} />
            ))}
          </Slider>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} look={look} isPreview={ctx.isPreview} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- Promo banner ---------- */

export function PromoBannerBlock({ props, variant, ctx, look }: BlockProps<PromoBannerProps>) {
  const l = LOOKS[look];
  const image = mediaOf(ctx, props.image_media_id);
  if (!image && !props.title) return <PreviewEmpty ctx={ctx} label={ar.sections.promo_banner.label} />;
  const center = props.align === "center";
  const text = (
    <div className={cn("flex flex-col gap-3", center ? "items-center text-center" : "items-start")}>
      {props.eyebrow ? <span className={l.chip}>{props.eyebrow}</span> : null}
      {props.title ? <h2 className="t-heading text-2xl font-extrabold leading-tight md:text-4xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="max-w-lg text-sm opacity-90 md:text-lg">{props.subtitle}</p> : null}
      {props.cta_label ? (
        <SafeLink href={ctx.isPreview ? null : props.cta_url} className={cn(l.button, "mt-2")}>
          {props.cta_label}
        </SafeLink>
      ) : null}
    </div>
  );

  if (variant === "split" || !image) {
    return (
      <section className={l.section}>
        <div className={cn(l.container, "grid max-w-6xl items-center gap-8 md:grid-cols-2", l.tint, "p-6 md:p-10")}>
          {text}
          {image ? <ResponsiveImage image={image} sizes="(min-width: 768px) 50vw, 100vw" className={cn("w-full object-cover", l.frame)} /> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={l.section}>
      <div className={cn(l.container, "relative max-w-6xl overflow-hidden", l.frame)}>
        <ResponsiveImage image={image} sizes="100vw" className="h-80 w-full object-cover md:h-[28rem]" />
        <div className={cn("absolute inset-0 flex p-6 text-white md:p-12", center ? "items-center justify-center" : "items-center")} style={{ background: `rgba(0,0,0,${Math.min(80, Math.max(0, Number(props.overlay) || 0)) / 100})` }}>
          {text}
        </div>
      </div>
    </section>
  );
}

