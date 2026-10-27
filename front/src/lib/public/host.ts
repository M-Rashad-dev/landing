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

/** "" for the home page, the slug for one level, null for deeper paths (404). */
export function slugFromSegments(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return "";
  if (segments.length > 1) return null;
  try {
    return decodeURIComponent(segments[0]).toLowerCase();
  } catch {
    return null;
  }
}

export function pathForSlug(slug: string): string {
  return slug === "" ? "/" : `/${encodeURIComponent(slug)}`;
}

/**
 * Where a non-primary host redirects to: https on the default port in production,
 * PUBLIC_SCHEME/PUBLIC_PORT locally (e.g. http://store.localhost:3000).
 */
export function primaryRedirectUrl(primaryHost: string, path: string, opts: { scheme?: string | null; port?: string | null } = {}): string {
  const scheme = opts.scheme === "http" ? "http" : "https";
  const port = opts.port ? `:${opts.port}` : "";
  return `${scheme}://${primaryHost}${port}${path}`;
}
