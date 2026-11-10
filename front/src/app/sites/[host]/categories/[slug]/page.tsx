import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreProducts, listQuery, queryKeyOf, type StoreConfig } from "@/lib/public/store";
import { loadStore, storeMetadata } from "@/lib/public/store-route";
import { siteMessages } from "@/messages/site";
import { storePaths } from "@/themes/shared/store/links";
import { storeLook } from "@/themes/store/look";
import { ProductListing, type Crumb } from "@/themes/store/product-listing";
import { StoreBeacon } from "@/themes/store/store-beacon";
import { StoreFrame, storeContext } from "@/themes/store/store-frame";
import { SuspendedStore } from "../../suspended";

const t = siteMessages.store;

type Props = { params: Promise<{ host: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function decode(slug: string): string | null {
  try {
    return decodeURIComponent(slug).toLowerCase().slice(0, 120);
  } catch {
    return null;
  }
}

function findCategory(config: StoreConfig, slug: string | null) {
  return slug ? config.categories.find((c) => c.slug.toLowerCase() === slug) : undefined;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { host, slug } = await params;
  const store = await loadStore(host, storePaths.category(slug));
  if (!store.config) return { title: { absolute: "—" } };
  const category = findCategory(store.config, decode(slug));
  if (!category) notFound();
  const query = listQuery(await searchParams);
  return storeMetadata(store.config, {
    title: category.seo?.title || category.name,
    description: category.seo?.description || category.description,
    path: storePaths.category(category.slug),
    image: category.image?.urls.large,
    noindex: Object.keys(query).length > 0,
  });
}

/** A category: its products and those of its sub-categories, with the same filters as /products. */
export default async function StoreCategoryPage({ params, searchParams }: Props) {
  const { host: rawHost, slug } = await params;
  const store = await loadStore(rawHost, storePaths.category(slug));
  if (!store.config) return <SuspendedStore />;
  const { config, host } = store;
  const category = findCategory(config, decode(slug));
  if (!category) notFound();
  const query = listQuery(await searchParams, category.slug);
  const list = await getStoreProducts(host, queryKeyOf(query));
  if (!list) notFound();

  const byId = new Map(config.categories.map((c) => [c.id, c]));
  const trail: Crumb[] = [];
  for (let c = byId.get(category.parent_id ?? -1); c; c = c.parent_id === null ? undefined : byId.get(c.parent_id)) trail.unshift({ label: c.name, href: storePaths.category(c.slug) });

  return (
    <StoreFrame config={config} ctx={storeContext(config, host)}>
      <ProductListing
        title={category.name}
        description={category.description}
        crumbs={[{ label: t.home, href: storePaths.home }, ...trail, { label: category.name }]}
        list={list}
        query={query}
        basePath={storePaths.category(category.slug)}
        chips={config.categories.filter((c) => c.parent_id === category.id)}
        look={storeLook(config.theme_key)}
      />
      <StoreBeacon type="view" onceKey={`category-${category.id}`} />
    </StoreFrame>
  );
}
