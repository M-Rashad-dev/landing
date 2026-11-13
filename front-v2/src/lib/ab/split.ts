/**
 * A/B split of landing pages, used by the proxy: each route is page A's link, whose visitors see
 * page A or page B under that same link; the choice is kept in a cookie for 30 days.
 */
export type AbRoute = { id: number; entries: string[]; a: string; b: string; split_a: number };
export type Variant = "a" | "b";

export const VARIANT_COOKIE = (id: number) => `lp_ab_${id}`;
export const AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Slug of a landing page link ("/Offer/" → "offer"); null for the store home and other paths. */
export function slugOfPath(pathname: string): string | null {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (trimmed === "" || trimmed.includes("/") || trimmed.includes(".")) return null;
  try {
    return decodeURIComponent(trimmed).toLowerCase();
  } catch {
    return null;
  }
}

export function matchRoute(routes: AbRoute[], pathname: string): AbRoute | null {
  const slug = slugOfPath(pathname);
  if (slug === null) return null;
  return routes.find((route) => route.entries.includes(slug)) ?? null;
}

/** split_a 0 = finished with B as winner: everyone gets B. A kept cookie wins while the test runs. */
export function pickVariant(route: AbRoute, saved: string | undefined, random: number = Math.random()): Variant {
  if (route.split_a <= 0) return "b";
  if (saved === "a" || saved === "b") return saved;
  return random * 100 < route.split_a ? "a" : "b";
}

type CacheEntry = { expires: number; routes: AbRoute[] };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;
const FAILURE_TTL_MS = 10_000;

/** Running tests of a host, cached in memory for 30 s (an empty list when Laravel is slow or down). */
export async function routesForHost(host: string, now: number = Date.now()): Promise<AbRoute[]> {
  const hit = cache.get(host);
  if (hit && hit.expires > now) return hit.routes;

  const base = (process.env.LARAVEL_INTERNAL_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/api/v1/public/ab-routes?host=${encodeURIComponent(host)}`, {
      headers: { Accept: "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    });
    const routes = response.ok ? (((await response.json()) as { data?: AbRoute[] }).data ?? []) : [];
    cache.set(host, { expires: now + (response.ok ? TTL_MS : FAILURE_TTL_MS), routes });
    if (cache.size > 5000) cache.delete(cache.keys().next().value as string);
    return routes;
  } catch {
    cache.set(host, { expires: now + FAILURE_TTL_MS, routes: [] });
    return [];
  }
}
