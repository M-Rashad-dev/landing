import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreProducts, listQuery, liveStore, queryKeyOf, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { Listing } from "@/themes/asas/pages/listing";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  const query = listQuery(await searchParams);
  // Searches and filtered lists stay out of search engines.
  return storeMetadata(config, { title: ar.storefront.allProducts, path: "/products", noindex: Object.keys(query).length > 0 });
}

/** «كل المنتجات», also the search results (?q=). */
export default async function ProductsPage({ params, searchParams }: Props) {
  const { host } = await liveStore((await params).host);
  const query = listQuery(await searchParams);
  const list = await getStoreProducts(host, queryKeyOf(query));
  if (!list) notFound();
  return <Listing title={ar.storefront.allProducts} breadcrumb={[{ name: ar.storefront.allProducts }]} list={list} filters={query} basePath="/products" />;
}
