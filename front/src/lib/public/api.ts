import "server-only";
import { cache } from "react";
import { serverEnv } from "@/lib/env";
import type { PublicIdentity } from "@/themes/types";
import type { PublicPagePayload, PublicSitemap, ResolvedHost } from "./types";

/** Data cache: 60 s, purged early by /api/revalidate through the host tag. */
export const PUBLIC_REVALIDATE = 60;

export function hostTag(host: string): string {
  return `host:${host.toLowerCase()}`;
}

/**
 * GET a public endpoint for a host. 404 → null; anything else that is not 2xx throws
 * (Next shows the error page and keeps serving the last good cached version).
 */
async function publicGet<T>(path: string, host: string, query: Record<string, string> = {}): Promise<T | null> {
  const env = serverEnv();
  const params = new URLSearchParams({ host, ...query });
  const response = await fetch(`${env.laravelUrl}/api/v1/public/${path}?${params.toString()}`, {
    headers: { Accept: "application/json", "X-Internal-Key": env.internalApiKey },
    next: { revalidate: PUBLIC_REVALIDATE, tags: [hostTag(host)] },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public ${path} failed with HTTP ${response.status}`);
  const json = (await response.json()) as { data: T };
  return json.data;
}

export const resolveHost = cache((host: string) => publicGet<ResolvedHost>("resolve-host", host));

export const getPublicPage = cache((host: string, slug: string) => publicGet<PublicPagePayload>("pages", host, { slug }));

export const getSitemap = cache((host: string) => publicGet<PublicSitemap>("sitemap", host));

/** Store look for /track: default identity + home slug. */
export const getStoreBrand = cache((host: string) => publicGet<{ identity: PublicIdentity | null; home_slug: string | null }>("brand", host));
