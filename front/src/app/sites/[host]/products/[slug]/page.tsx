import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/shared/markdown";
import { bestUnitOffer } from "@/lib/price/offers";
import { absoluteUrl, jsonLdString, stripMarkdown } from "@/lib/public/seo";
import { getStoreProduct } from "@/lib/public/store";
import { loadStore, storeMetadata } from "@/lib/public/store-route";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { GalleryClient } from "@/themes/shared/components/gallery-client";
import { LOOKS } from "@/themes/shared/sections/looks";
import { storePaths } from "@/themes/shared/store/links";
import { ProductCard } from "@/themes/shared/store/product-card";
import { storeLook } from "@/themes/store/look";
import { Breadcrumb } from "@/themes/store/product-listing";
import { ProductPurchase } from "@/themes/store/product-purchase";
import { StoreBeacon } from "@/themes/store/store-beacon";
import { StoreFrame, storeContext } from "@/themes/store/store-frame";
import { SuspendedStore } from "../../suspended";

const t = siteMessages.store;

/** ISR like the landing pages: cached per host/path, refreshed by tag on edit (or after 60 s). */
export const revalidate = 60;

export function generateStaticParams(): Array<Record<string, string>> {
  return [];
}

type Props = { params: Promise<{ host: string; slug: string }> };

function decode(slug: string): string | null {
  try {
    return decodeURIComponent(slug).toLowerCase().slice(0, 120);
  } catch {
    return null;
  }
}

async function load(params: Props["params"]) {
  const { host, slug } = await params;
  const store = await loadStore(host, storePaths.product(slug));
  if (!store.config) return { store, page: null };
  const decoded = decode(slug);
  const page = decoded ? await getStoreProduct(store.host, decoded) : null;
  if (!page) notFound();
  return { store, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store, page } = await load(params);
  if (!store.config || !page) return { title: { absolute: "—" } };
  const { product, seo } = page;
  return storeMetadata(store.config, {
    title: seo?.title || product.name,
    description: seo?.description || product.description,
    path: storePaths.product(product.slug ?? ""),
    image: product.images[0]?.urls.large,
    noindex: Boolean(seo?.noindex),
  });
}

/** A store product: gallery, price, options, stock, add to cart / buy now, description, related. */
export default async function StoreProductPage({ params }: Props) {
  const { store, page } = await load(params);
  if (!store.config || !page) return <SuspendedStore />;
  const { config, host } = store;
  const { product, offers, breadcrumb, related } = page;
  const look = storeLook(config.theme_key);
  const block = LOOKS[look.block];
  const canonical = new URL(storePaths.product(product.slug ?? ""), config.seo.canonical).toString();
  const best = bestUnitOffer(offers, product);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: stripMarkdown(product.description).slice(0, 5000) || undefined,
    image: product.images.map((i) => absoluteUrl(i.urls.large, canonical)).filter(Boolean),
    brand: config.identity.brand_name ? { "@type": "Brand", name: config.identity.brand_name } : undefined,
    offers: { "@type": "Offer", url: canonical, price: (best ? best.unit : product.price).toFixed(2), priceCurrency: "EGP", availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  const crumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: t.home, path: "/" }, ...breadcrumb.map((c) => ({ name: c.name, path: storePaths.category(c.slug) })), { name: product.name, path: storePaths.product(product.slug ?? "") }].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, config.seo.canonical).toString(),
    })),
  };

  return (
    <StoreFrame config={config} ctx={storeContext(config, host)}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <Breadcrumb items={[{ label: t.home, href: storePaths.home }, ...breadcrumb.map((c) => ({ label: c.name, href: storePaths.category(c.slug) })), { label: product.name }]} look={look} />
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div>
            {product.images.length > 0 ? (
              <GalleryClient images={product.images} layout="slider" autoplay={false} showThumbnails lightbox frameClassName={block.frame} />
            ) : (
              <div className={cn(block.frame, "t-tint flex aspect-square items-center justify-center")}>
                <span className={look.muted}>{siteMessages.noImage}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <h1 className="t-heading text-2xl font-extrabold leading-tight md:text-3xl">{product.name}</h1>
            <ProductPurchase product={product} offers={offers} lowStock={page.low_stock_threshold} buttonClassName={block.button} secondaryClassName={look.chip(false)} />
            {product.description ? (
              <section className={look.surface} aria-label={t.details}>
                <h2 className="t-heading mb-3 font-bold">{t.details}</h2>
                <Markdown className="leading-relaxed [&_a]:underline [&_h2]:mt-3 [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ps-5">{product.description}</Markdown>
              </section>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-16">
            <h2 className={cn(block.heading, "mb-6")}>{t.related}</h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
              {related.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} look={look.block} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <StoreBeacon type="product_view" onceKey={String(product.id)} pixel={{ content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString([jsonLd, crumbsLd]) }} />
    </StoreFrame>
  );
}
