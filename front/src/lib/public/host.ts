/** Host names as they reach /sites/[host] (the proxy encodes them). */
const HOST_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

export function parseSiteHost(raw: string): string | null {
  let host: string;
  try {
    host = decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return null;
  }
  return HOST_PATTERN.test(host) ? host : null;
}

/**
 * Where a non-primary host redirects to: https on the default port in production,
 * PUBLIC_SCHEME / PUBLIC_PORT locally (e.g. http://store.localhost:3200).
 */
export function primaryRedirectUrl(primaryHost: string, path: string, opts: { scheme?: string | null; port?: string | null } = {}): string {
  const scheme = opts.scheme === "http" ? "http" : "https";
  const port = opts.port ? `:${opts.port}` : "";
  return `${scheme}://${primaryHost}${port}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Header the proxy sets with the visitor's path (the site layout needs it for redirects). */
export const SITE_PATH_HEADER = "x-site-path";
