import { normalizeHost } from "@/lib/http/request";

export type HostKind = "platform" | "app" | "tenant";

export function classifyHost(rawHost: string | null | undefined, config: { platformDomain: string; appHost: string }): HostKind {
  const host = normalizeHost(rawHost);
  if (host === config.appHost) return "app";
  if (host === config.platformDomain || host === `www.${config.platformDomain}`) return "platform";
  return "tenant";
}

/** Paths that exist only on the app host: a store host answers them with 404. */
export const APP_ONLY_PREFIXES = ["/dashboard", "/admin", "/login", "/register", "/api/bff", "/api/auth"];

/** Paths the app host serves; anything else is a 404 there (store pages live on store hosts only). */
export const APP_ALLOWED_PREFIXES = ["/login", "/register", "/dashboard", "/admin", "/api", "/media"];

/** Endpoints a store visitor may call on the store's own host. */
export const STORE_API_PREFIXES = ["/api/public"];

export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
