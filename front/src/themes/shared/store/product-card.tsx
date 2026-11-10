import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { Price } from "@/themes/shared/components/price";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { LOOKS, type LookKey } from "@/themes/shared/sections/looks";
import type { StoreProductCard } from "@/themes/types";
import { AddToCartButton } from "./add-to-cart-button";
import { productHref } from "./links";

const t = siteMessages.store;

/** One product in a grid / listing: image, name, price, badges and a direct add-to-cart. */
export function ProductCard({ product, look, isPreview = false, priority = false }: { product: StoreProductCard; look: LookKey; isPreview?: boolean; priority?: boolean }) {
  const l = LOOKS[look];
  const href = isPreview ? undefined : (productHref(product) ?? undefined);

  return (
    <article className={cn(l.card, "group flex h-full flex-col overflow-hidden")} data-product-card={product.id}>
      <a href={href} className="relative block aspect-square overflow-hidden bg-black/5" tabIndex={href ? undefined : -1}>
        {product.image ? (
          <ResponsiveImage image={product.image} sizes="(min-width: 1024px) 25vw, 50vw" priority={priority} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt={product.image.alt ?? product.name} />
        ) : (
          <span className="t-muted flex h-full items-center justify-center text-xs">{siteMessages.noImage}</span>
        )}
        <span className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {product.discount_percent ? <span className={l.chip}>{t.discount(product.discount_percent)}</span> : null}
          {!product.available ? <span className={l.chip}>{t.outOfStock}</span> : product.is_featured ? <span className={l.chip}>{t.featured}</span> : null}
        </span>
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        <h3 className="t-heading line-clamp-2 text-sm font-bold leading-snug md:text-base">
          <a href={href}>{product.name}</a>
        </h3>
        {product.short_description ? <p className="t-muted line-clamp-2 text-xs leading-relaxed">{product.short_description}</p> : null}
        <Price price={product.price} compareAt={product.compare_at_price} className="mt-auto" priceClassName="text-base font-extrabold" compareClassName="text-xs" />
        {product.needs_options ? (
          <a href={href} className={cn(l.button, "min-h-10 w-full px-3 text-sm")}>
            {t.chooseOptions}
          </a>
        ) : (
          <AddToCartButton
            isPreview={isPreview}
            disabled={!product.available}
            className={cn(l.button, "min-h-10 w-full px-3 text-sm")}
            label={product.available ? t.addToCart : t.outOfStock}
            item={{
              product_id: product.id,
              quantity: 1,
              options: {},
              name: product.name,
              slug: product.slug,
              image: product.image?.urls.thumb ?? null,
              price: product.price,
              options_label: "",
            }}
          />
        )}
      </div>
    </article>
  );
}
