import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreProducts, listQuery, liveStore, queryKeyOf, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { Listing } from "@/themes/asas/pages/listing";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.offersPage, path: "/offers", noindex: Object.keys(listQuery(await searchParams)).length > 0 });
}

/** «العروض»: products with a lower price than the old one, or covered by an active offer. */
export default async function OffersPage({ params, searchParams }: Props) {
  const { host } = await liveStore((await params).host);
  const { category: _category, offers: _offers, ...filters } = listQuery(await searchParams);
  void _category;
  void _offers;
  const list = await getStoreProducts(host, queryKeyOf({ ...filters, offers: "1" }));
  if (!list) notFound();
  return <Listing title={ar.storefront.offersPage} breadcrumb={[{ name: ar.storefront.offersPage }]} list={list} filters={filters} basePath="/offers" kind="offers" />;
}
