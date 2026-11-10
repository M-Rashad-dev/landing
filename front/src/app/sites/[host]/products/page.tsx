import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreProducts, listQuery, queryKeyOf } from "@/lib/public/store";
import { loadStore, storeMetadata } from "@/lib/public/store-route";
import { siteMessages } from "@/messages/site";
import { storePaths } from "@/themes/shared/store/links";
import { storeLook } from "@/themes/store/look";
import { ProductListing } from "@/themes/store/product-listing";
import { StoreBeacon } from "@/themes/store/store-beacon";
import { StoreFrame, storeContext } from "@/themes/store/store-frame";
import { SuspendedStore } from "../suspended";

const t = siteMessages.store;

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const store = await loadStore((await params).host, storePaths.products);
  if (!store.config) return { title: { absolute: "—" } };
  const query = listQuery(await searchParams);
  // Search results and filtered lists are not indexed (the plain list is).
  return storeMetadata(store.config, { title: query.q ? t.searchResults(query.q) : t.allProducts, path: storePaths.products, noindex: Object.keys(query).length > 0 });
}

/** All products of the store: search (?q), sort, price range, in stock, pages. */
export default async function StoreProductsPage({ params, searchParams }: Props) {
  const store = await loadStore((await params).host, storePaths.products);
  if (!store.config) return <SuspendedStore />;
  const { config, host } = store;
  const query = listQuery(await searchParams);
  const list = await getStoreProducts(host, queryKeyOf(query));
  if (!list) notFound();
  const look = storeLook(config.theme_key);

  return (
    <StoreFrame config={config} ctx={storeContext(config, host)} searchQuery={query.q}>
      <ProductListing
        title={query.q ? t.searchResults(query.q) : t.allProducts}
        crumbs={[{ label: t.home, href: storePaths.home }, { label: t.allProducts }]}
        list={list}
        query={query}
        basePath={storePaths.products}
        chips={config.categories.filter((c) => c.parent_id === null)}
        look={look}
      />
      <StoreBeacon type="view" onceKey="products" />
    </StoreFrame>
  );
}
