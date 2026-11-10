import "server-only";
import { cache } from "react";
import { serverEnv } from "@/lib/env";
import type { Tracking } from "@/lib/tracking/ids";
import type { PageContent, PageContext, PublicOffer, PublicProduct, StoreCategory, StoreProductCard, StoreSectionData } from "@/themes/types";
import { hostTag, PUBLIC_REVALIDATE } from "./api";

/* ---------- Types (back: App\Store\StoreSite) ---------- */

export type StoreMenuLink = { label: string; href: string; children: Array<{ label: string; href: string }> };

export type StoreConfig = {
  theme_key: string;
  settings: { announcement: string | null; products_per_page: number; show_whatsapp: boolean; show_out_of_stock: boolean };
  identity: PageContext["identity"] | null;
  menus: { header: StoreMenuLink[]; footer: StoreMenuLink[] };
  categories: StoreCategory[];
  pages: Array<{ title: string; slug: string }>;
  home: { id: number | null; content: PageContent; media: PageContext["media"]; data: Pick<StoreSectionData, "products"> };
  seo: { title: string; description: string; canonical: string; site_name: string | null };
  tracking: Tracking | null;
  shipping: PageContext["shipping"];
  branding: boolean;
  primary_host: string;
};

export type StoreProductList = { data: StoreProductCard[]; meta: { current_page: number; last_page: number; per_page: number; total: number } };

export type StoreProductPage = {
  product: PublicProduct & { slug?: string | null; stock_mode?: "unlimited" | "product" | "variant"; stock?: number | null; variant_stock?: Record<string, number> };
  offers: PublicOffer[];
  breadcrumb: Array<{ name: string; slug: string }>;
  seo: { title?: string | null; description?: string | null; og_media_id?: number | null; noindex?: boolean | null } | null;
  related: StoreProductCard[];
  low_stock_threshold: number | null;
};

export type StoreStaticPage = { title: string; slug: string; body: string | null; seo: { title?: string | null; description?: string | null } | null };

export const STORE_SORTS = ["newest", "price_asc", "price_desc", "best_sellers", "featured"] as const;
export type StoreSort = (typeof STORE_SORTS)[number];

export type StoreListQuery = { category?: string; q?: string; sort?: StoreSort; min?: string; max?: string; in_stock?: "1"; page?: string };

/* ---------- Loaders ---------- */

/**
 * GET a store endpoint for a host (cached like the pages, purged by the host tag).
 * 404 (no live store / unknown item) → null; anything else that is not 2xx throws.
 */
async function storeGet<T>(path: string, host: string, query: Record<string, string> = {}): Promise<{ data: T; meta?: unknown } | null> {
  const env = serverEnv();
  const params = new URLSearchParams({ host, ...query });
  const response = await fetch(`${env.laravelUrl}/api/v1/public/${path}?${params.toString()}`, {
    headers: { Accept: "application/json", "X-Internal-Key": env.internalApiKey },
    next: { revalidate: PUBLIC_REVALIDATE, tags: [hostTag(host)] },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public ${path} failed with HTTP ${response.status}`);
  return (await response.json()) as { data: T; meta?: unknown };
}

export const getStoreConfig = cache(async (host: string) => (await storeGet<StoreConfig>("store", host))?.data ?? null);

export const getStoreProducts = cache(async (host: string, queryKey: string) => {
  const json = await storeGet<StoreProductCard[]>("store/products", host, Object.fromEntries(new URLSearchParams(queryKey)));
  return json ? ({ data: json.data, meta: json.meta } as StoreProductList) : null;
});

export const getStoreProduct = cache(async (host: string, slug: string) => (await storeGet<StoreProductPage>(`store/products/${encodeURIComponent(slug)}`, host))?.data ?? null);

export const getStorePage = cache(async (host: string, slug: string) => (await storeGet<StoreStaticPage>(`store/pages/${encodeURIComponent(slug)}`, host))?.data ?? null);

/** Clean, bounded list query from the URL search params (unknown keys dropped). */
export function listQuery(search: Record<string, string | string[] | undefined>, category?: string): StoreListQuery {
  const one = (key: string) => {
    const v = search[key];
    return typeof v === "string" ? v.trim() : undefined;
  };
  const out: StoreListQuery = {};
  if (category) out.category = category;
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

export function queryKeyOf(query: StoreListQuery): string {
  return new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined) as Array<[string, string]>).toString();
}
