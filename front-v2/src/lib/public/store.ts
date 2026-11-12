import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { serverEnv } from "@/lib/env";
import type { ProductList, ProductPage, StaticPage, StoreConfig } from "@/lib/store/types";
import { pick } from "@/themes/asas/types";
import { publicGet } from "./fetch";
import { parseSiteHost, primaryRedirectUrl, SITE_PATH_HEADER } from "./host";
import { absoluteUrl, stripMarkdown } from "./seo";

/** GET /public/resolve-host */
type ResolvedHost = { host: string; status: "active" | "suspended"; primary_host: string; is_primary: boolean; store_live: boolean };

const resolveHost = cache(async (host: string) => (await publicGet<ResolvedHost>("resolve-host", host))?.data ?? null);

export const getStoreConfig = cache(async (host: string) => (await publicGet<StoreConfig>("store", host))?.data ?? null);

export const getStoreProducts = cache(async (host: string, queryKey: string): Promise<ProductList | null> => {
  const json = await publicGet<ProductList["data"]>("store/products", host, Object.fromEntries(new URLSearchParams(queryKey)));
  return json ? { data: json.data, meta: json.meta as ProductList["meta"] } : null;
});

export const getStoreProduct = cache(async (host: string, slug: string) => (await publicGet<ProductPage>(`store/products/${encodeURIComponent(slug)}`, host))?.data ?? null);

export const getStorePage = cache(async (host: string, slug: string) => (await publicGet<StaticPage>(`store/pages/${encodeURIComponent(slug)}`, host))?.data ?? null);

export type LiveStore = { host: string; config: StoreConfig; suspended: false } | { host: string; config: null; suspended: true };

/**
 * Every store page: host → site → live store. Unknown host or no live store → 404; a suspended
 * (or unpaid) store → the paused page; a host that is not the primary one → permanent redirect to
 * the primary host on the same path.
 */
export const loadStore = cache(async (rawHost: string): Promise<LiveStore> => {
  const host = parseSiteHost(rawHost);
  if (!host) notFound();
  const site = await resolveHost(host);
  if (!site) notFound();
  if (site.status === "suspended") return { host, config: null, suspended: true };
  if (!site.is_primary) {
    const env = serverEnv();
    const path = (await headers()).get(SITE_PATH_HEADER) ?? "/";
    permanentRedirect(primaryRedirectUrl(site.primary_host, path.startsWith("/") ? path : "/", { scheme: env.publicScheme, port: env.publicPort }));
  }
  if (!site.store_live) notFound();
  const config = await getStoreConfig(host);
  if (!config) notFound();
  return { host, config, suspended: false };
});

/** The live store or a 404 (pages render inside the layout, which already showed a paused store). */
export async function liveStore(rawHost: string): Promise<{ host: string; config: StoreConfig }> {
  const store = await loadStore(rawHost);
  if (store.suspended) notFound();
  return store;
}

/** Title / description / canonical / Open Graph of a store page (falls back to the store SEO). */
export function storeMetadata(config: StoreConfig, page: { title?: string | null; description?: string | null; path: string; image?: string | null; noindex?: boolean }): Metadata {
  const brand = config.seo.site_name || config.store_name;
  const title = page.title ? (page.title.includes(brand) ? page.title : `${page.title} | ${brand}`) : config.seo.title || brand;
  const description = stripMarkdown(page.description ?? config.seo.description).slice(0, 170) || null;
  const canonical = new URL(page.path, config.seo.canonical).toString();
  const image = absoluteUrl(page.image ?? null, canonical);
  const faviconId = config.design.settings.favicon_media_id;
  const favicon = faviconId ? pick(config.data.media[String(faviconId)], "thumb") : null;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: page.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "website", locale: "ar_EG", url: canonical, siteName: brand, title, description: description ?? undefined, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description: description ?? undefined, images: image ? [image] : undefined },
    icons: favicon ? { icon: [{ url: favicon }], apple: [{ url: favicon }] } : undefined,
  };
}

/* ---------- Product lists ---------- */

export const STORE_SORTS = ["newest", "price_asc", "price_desc", "best_sellers", "featured"] as const;
export type StoreSort = (typeof STORE_SORTS)[number];

export type ListQuery = { category?: string; offers?: "1"; q?: string; sort?: StoreSort; min?: string; max?: string; in_stock?: "1"; page?: string };

/** A clean, bounded list query from the URL (unknown keys dropped). */
export function listQuery(search: Record<string, string | string[] | undefined>, fixed: Pick<ListQuery, "category" | "offers"> = {}): ListQuery {
  const one = (key: string) => {
    const v = search[key];
    return typeof v === "string" ? v.trim() : undefined;
  };
  const out: ListQuery = { ...fixed };
  const q = one("q");
  if (q) out.q = q.slice(0, 60);
  const sort = one("sort");
  if (sort && (STORE_SORTS as readonly string[]).includes(sort)) out.sort = sort as StoreSort;
  for (const key of ["min", "max"] as const) {
    const v = one(key);
    if (v && /^\d{1,7}(\.\d{1,2})?$/.test(v)) out[key] = v;
  }
  if (one("in_stock") === "1") out.in_stock = "1";
  const page = one("page");
  if (page && /^\d{1,4}$/.test(page) && Number(page) > 1) out.page = page;
  return out;
}

export function queryKeyOf(query: ListQuery): string {
  return new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined) as Array<[string, string]>).toString();
}
