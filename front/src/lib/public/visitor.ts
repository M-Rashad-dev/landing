import "server-only";
import { NextResponse } from "next/server";
import { laravelFetch } from "@/lib/api/server";
import { normalizeHost } from "@/lib/host/classify";

const MAX_BODY_BYTES = 32 * 1024;

/** Host the visitor is on (Caddy keeps the original Host). */
export function visitorHost(request: Request): string {
  return normalizeHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
}

/**
 * Client IP: first X-Forwarded-For entry. Behind Caddy that header is set from the real
 * connection (untrusted incoming values are replaced), so it cannot be spoofed by visitors.
 */
export function visitorIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

/** Visitor JSON body, size-limited; null when missing, too big or not an object. */
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

/** Relays Laravel's answer (status + JSON) without caching. */
export async function relay(upstream: Promise<Response>): Promise<NextResponse> {
  try {
    const response = await upstream;
    const json = (await response.json().catch(() => ({}))) as unknown;
    return NextResponse.json(json, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "تعذر الاتصال بالخادم.", code: "upstream_unavailable" }, { status: 502 });
  }
}

export function forwardPublic(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Response> {
  return laravelFetch(path, { auth: false, internal: true, method: init.method ?? "GET", body: init.body });
}

export function badRequest(): NextResponse {
  return NextResponse.json({ message: "طلب غير صالح.", code: "bad_request" }, { status: 400 });
}
