import "server-only";
import { serverEnv } from "@/lib/env";

/** Data cache: 60 s, purged early by /api/revalidate through the host tag. */
export const PUBLIC_REVALIDATE = 60;

export function hostTag(host: string): string {
  return `host:${host.toLowerCase()}`;
}

/**
 * GET a public endpoint for a host, cached per host. 404 → null; anything else that is not 2xx
 * throws (Next shows the error page and keeps serving the last good cached copy).
 */
export async function publicGet<T>(path: string, host: string, query: Record<string, string> = {}): Promise<{ data: T; meta?: unknown } | null> {
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
