import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jsonLdString, productJsonLd } from "@/lib/public/seo";
import { getStoreProduct, liveStore, storeMetadata } from "@/lib/public/store";
import { storeTheme } from "@/themes/store/registry";
import { pick } from "@/themes/shared/design";

type Props = { params: Promise<{ host: string; slug: string }> };

function slugOf(raw: string): string | null {
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host: rawHost, slug: rawSlug } = await params;
  const { host, config } = await liveStore(rawHost);
  const slug = slugOf(rawSlug);
  const page = slug ? await getStoreProduct(host, slug) : null;
  if (!page) return {};
  return storeMetadata(config, {
    title: page.seo?.title || page.product.name,
    description: page.seo?.description || page.product.short_description || page.product.description,
    path: `/products/${encodeURIComponent(page.product.slug)}`,
    image: pick(page.product.images[0]?.urls, "large"),
    noindex: Boolean(page.seo?.noindex),
  });
}

export default async function ProductPage({ params }: Props) {
  const { host: rawHost, slug: rawSlug } = await params;
  const { host, config } = await liveStore(rawHost);
  const slug = slugOf(rawSlug);
  const page = slug ? await getStoreProduct(host, slug) : null;
  if (!page) notFound();
  const canonical = new URL(`/products/${encodeURIComponent(page.product.slug)}`, config.seo.canonical).toString();

  const { Product } = storeTheme(config.theme_key).pages;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd(page, canonical, config.store_name)) }} />
      <Product key={page.product.id} page={page} />
    </>
  );
}
