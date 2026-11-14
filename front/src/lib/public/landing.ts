import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { serverEnv } from "@/lib/env";
import type { Tracking } from "@/lib/tracking/ids";
import type { Content, LandingData } from "@/themes/bidaya/types";
import { publicGet } from "./fetch";
import { parseSiteHost, primaryRedirectUrl, SITE_PATH_HEADER } from "./host";

type ResolvedHost = { host: string; status: "active" | "suspended"; primary_host: string; is_primary: boolean };

/** GET /public/pages: a published landing page with what it shows (back end: PublicSite::payload). */
export type LandingPayload = Omit<LandingData, "page"> & {
  page: { id: number; slug: string; title: string; theme_key: string };
  theme_key: string;
  content: Content;
  seo: { title: string; description: string; og_image: { url: string | null; width: number | null; height: number | null; alt: string | null } | null; canonical: string; noindex: boolean; site_name: string | null };
  tracking: Tracking | null;
  branding: boolean;
};

export type LandingSite = { host: string; suspended: true; page: null } | { host: string; suspended: false; page: LandingPayload };

const resolveHost = cache(async (host: string) => (await publicGet<ResolvedHost>("resolve-host", host))?.data ?? null);

export const getLandingPage = cache(async (host: string, slug: string) => (await publicGet<LandingPayload>("pages", host, { slug }))?.data ?? null);

/**
 * A landing page on a store's domain: unknown host or page → 404; a suspended (or unpaid) site →
 * the paused page; another host of the same store → permanent redirect to the primary one.
 * A landing page works whether or not the store itself is open.
 */
export const loadLandingPage = cache(async (rawHost: string, slug: string): Promise<LandingSite> => {
  const host = parseSiteHost(rawHost);
  if (!host) notFound();
  const site = await resolveHost(host);
  if (!site) notFound();
  if (site.status === "suspended") return { host, suspended: true, page: null };
  if (!site.is_primary) {
    const env = serverEnv();
    const path = (await headers()).get(SITE_PATH_HEADER) ?? "/";
    permanentRedirect(primaryRedirectUrl(site.primary_host, path.startsWith("/") ? path : "/", { scheme: env.publicScheme, port: env.publicPort }));
  }
  const page = await getLandingPage(host, slug);
  if (!page || page.theme_key !== "bidaya") notFound();
  return { host, suspended: false, page };
});

/** Title, description, canonical and share image of a landing page. */
export function landingMetadata(page: LandingPayload, path = ""): Metadata {
  const seo = page.seo;
  const canonical = path ? new URL(path, seo.canonical).toString() : seo.canonical;
  const image = seo.og_image?.url ?? null;
  return {
    title: { absolute: seo.title },
    description: seo.description || null,
    alternates: { canonical },
    robots: seo.noindex || path ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "website", locale: "ar_EG", url: canonical, siteName: seo.site_name ?? page.store_name, title: seo.title, description: seo.description || undefined, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description || undefined, images: image ? [image] : undefined },
  };
}
