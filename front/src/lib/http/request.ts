import type { NextRequest } from "next/server";
import { normalizeHost } from "@/lib/host/classify";

/** Host the visitor typed (Caddy keeps the original Host header). */
export function requestHost(request: NextRequest | Request): string {
  const headers = request.headers;
  return normalizeHost(headers.get("x-forwarded-host") ?? headers.get("host"));
}

/** First address of X-Forwarded-For (set by Caddy), else empty. */
export function clientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

/**
 * CSRF guard for cookie-authenticated, state-changing requests:
 * the Origin must be the host serving this request.
 */
export function isSameOrigin(request: NextRequest | Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return normalizeHost(new URL(origin).host) === requestHost(request);
  } catch {
    return false;
  }
}

export function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

/** Headers to tell Laravel who the real client is (Laravel trusts its private network). */
export function forwardedHeaders(request: NextRequest | Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const ip = clientIp(request);
  if (ip) headers["X-Forwarded-For"] = ip;
  const ua = request.headers.get("user-agent");
  if (ua) headers["User-Agent"] = ua.slice(0, 500);
  return headers;
}
