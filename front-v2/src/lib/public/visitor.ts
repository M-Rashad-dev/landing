import "server-only";
import { NextResponse } from "next/server";
import { laravelFetch } from "@/lib/api/server";
import { jsonError, upstreamUnavailable } from "@/lib/http/json";
import { clientIp, requestHost } from "@/lib/http/request";

const MAX_BODY_BYTES = 32 * 1024;

export const visitorHost = requestHost;

/** The visitor's IP (first X-Forwarded-For entry, set by Caddy from the real connection), or null. */
export function visitorIp(request: Request): string | null {
  const ip = clientIp(request);
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

/** The visitor's JSON body, size-limited; null when missing, too big or not an object. */
export async function visitorBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return null;
  try {
    const json = JSON.parse(text) as unknown;
    return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Calls a public endpoint (internal key, no dashboard token) and relays Laravel's answer, never cached. */
export async function relayPublic(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<NextResponse> {
  try {
    const response = await laravelFetch(path, { auth: false, internal: true, method: init.method ?? "GET", body: init.body });
    if (response.status === 202 || response.status === 204) return new NextResponse(null, { status: response.status, headers: { "Cache-Control": "no-store" } });
    const json = (await response.json().catch(() => ({}))) as unknown;
    return NextResponse.json(json, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return upstreamUnavailable();
  }
}

export function badRequest(): NextResponse {
  return jsonError(400, "bad_request");
}

/** Keeps only the listed keys of the visitor's body. */
export function pickKeys(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in body) out[key] = body[key];
  return out;
}
