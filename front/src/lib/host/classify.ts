export type HostKind = "platform" | "app" | "tenant";

/** Lowercase host without port or trailing dot. */
export function normalizeHost(rawHost: string | null | undefined): string {
  if (!rawHost) return "";
  let host = rawHost.trim().toLowerCase();
  if (host.startsWith("[")) {
    // IPv6 literal: [::1]:3000
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  const colon = host.lastIndexOf(":");
  if (colon !== -1) host = host.slice(0, colon);
  return host.replace(/\.$/, "");
}

export function classifyHost(
  rawHost: string | null | undefined,
  config: { platformDomain: string; appHost: string },
): HostKind {
  const host = normalizeHost(rawHost);
  if (host === config.appHost) return "app";
  if (host === config.platformDomain || host === `www.${config.platformDomain}`) return "platform";
  return "tenant";
}

/** Paths that exist only on the app host and must 404 on tenant hosts. */
export const APP_ONLY_PREFIXES = ["/dashboard", "/admin", "/preview", "/login", "/register", "/api/bff", "/api/auth", "/dev"];

/** Paths allowed on the app host; anything else is a 404 there. */
export const APP_ALLOWED_PREFIXES = ["/login", "/register", "/dashboard", "/admin", "/preview", "/api", "/dev"];

export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
