import "server-only";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { resolveHost } from "./api";
import { parseSiteHost, primaryRedirectUrl } from "./host";
import { absoluteUrl, stripMarkdown } from "./seo";
import { getStoreConfig, type StoreConfig } from "./store";
import type { PublicIdentity } from "@/themes/types";

export type LiveStore = { host: string; config: StoreConfig & { identity: PublicIdentity }; suspended: false } | { host: string; config: null; suspended: true };

/**
 * Every store route: host → tenant site → live store. Unknown host or no live store → 404;
 * a suspended tenant → the paused page; a non-primary host → permanent redirect to the
 * primary one (same path).
 */
export async function loadStore(rawHost: string, path: string): Promise<LiveStore> {
  const host = parseSiteHost(rawHost);
  if (!host) notFound();
  const site = await resolveHost(host);
  if (!site) notFound();
  if (site.status === "suspended") return { host, config: null, suspended: true };
  if (!site.is_primary) {
    const env = serverEnv();
    permanentRedirect(primaryRedirectUrl(site.primary_host, path, { scheme: env.publicScheme, port: env.publicPort }));
  }
  if (!site.store_live) notFound();
  const config = await getStoreConfig(host);
  if (!config || !config.identity) notFound();
  return { host, config: config as StoreConfig & { identity: PublicIdentity }, suspended: false };
}

/** Title / description / canonical / OG of a store page (falls back to the store SEO). */
export function storeMetadata(
  config: StoreConfig,
  page: { title?: string | null; description?: string | null; path: string; image?: string | null; noindex?: boolean },
): Metadata {
  const brand = config.seo.site_name ?? config.identity?.brand_name ?? "";
  const title = page.title ? (brand && page.title !== brand ? `${page.title} | ${brand}` : page.title) : config.seo.title || brand;
  const description = stripMarkdown(page.description ?? config.seo.description ?? "").slice(0, 170) || null;
  const canonical = new URL(page.path, config.seo.canonical).toString();
  const image = absoluteUrl(page.image ?? config.identity?.og_image?.urls.large ?? null, canonical);
  const favicon = config.identity?.favicon;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: page.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "website", locale: "ar_EG", url: canonical, siteName: brand || undefined, title, description: description ?? undefined, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description: description ?? undefined, images: image ? [image] : undefined },
    icons: favicon ? { icon: [{ url: favicon.icon32, sizes: "32x32", type: "image/png" }], apple: [{ url: favicon.icon180, sizes: "180x180", type: "image/png" }] } : undefined,
  };
}
