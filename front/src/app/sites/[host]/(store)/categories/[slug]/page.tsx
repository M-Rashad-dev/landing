import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreProducts, listQuery, liveStore, queryKeyOf, storeMetadata } from "@/lib/public/store";
import type { StoreCategory, StoreConfig } from "@/lib/store/types";
import { Listing } from "@/themes/asas/pages/listing";
import { pick } from "@/themes/asas/types";

type Props = { params: Promise<{ host: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function categoryOf(config: StoreConfig, raw: string): StoreCategory | null {
  let slug: string;
  try {
    slug = decodeURIComponent(raw).toLowerCase();
  } catch {
    return null;
  }
  return config.categories.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { host, slug } = await params;
  const { config } = await liveStore(host);
  const category = categoryOf(config, slug);
  if (!category) return {};
  return storeMetadata(config, {
    title: category.seo?.title || category.name,
    description: category.seo?.description || category.description,
    path: `/categories/${encodeURIComponent(category.slug)}`,
    image: pick(category.image?.urls, "large"),
    noindex: Boolean(category.seo?.noindex) || Object.keys(listQuery(await searchParams)).length > 0,
  });
}

/** A category with the products of its sub-categories, and the way down to them. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { host: rawHost, slug } = await params;
  const { host, config } = await liveStore(rawHost);
  const category = categoryOf(config, slug);
  if (!category) notFound();

  const { category: _c, offers: _o, ...filters } = listQuery(await searchParams);
  void _c;
  void _o;
  const list = await getStoreProducts(host, queryKeyOf({ ...filters, category: category.slug }));
  if (!list) notFound();

  const byId = new Map(config.categories.map((c) => [c.id, c]));
  const trail: StoreCategory[] = [];
  for (let c = category.parent_id ? byId.get(category.parent_id) : undefined; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) trail.unshift(c);

  return (
    <Listing
      title={category.name}
      description={category.description}
      breadcrumb={[...trail.map((c) => ({ name: c.name, href: `/categories/${encodeURIComponent(c.slug)}` })), { name: category.name }]}
      subcategories={config.categories.filter((c) => c.parent_id === category.id).map((c) => ({ name: c.name, slug: c.slug }))}
      list={list}
      filters={filters}
      basePath={`/categories/${encodeURIComponent(category.slug)}`}
    />
  );
}
