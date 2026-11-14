import { NextResponse } from "next/server";
import { isSecureRequest } from "@/lib/auth/cookie";
import { jsonError } from "@/lib/http/json";
import { isSameOrigin } from "@/lib/http/request";
import { badRequest, clearCustomerCookie, customerHeaders, pickKeys, relayPublic, setCustomerCookie, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };
type Method = "GET" | "POST" | "PUT" | "DELETE";

/** The calls a store customer may make, and the body keys each one takes. */
const ROUTES: Array<{ method: Method; pattern: RegExp; keys: readonly string[] }> = [
  { method: "GET", pattern: /^$/, keys: [] },
  { method: "PUT", pattern: /^$/, keys: ["name", "email"] },
  { method: "POST", pattern: /^code$/, keys: ["phone"] },
  { method: "POST", pattern: /^verify$/, keys: ["phone", "code"] },
  { method: "POST", pattern: /^sign-out$/, keys: [] },
  { method: "GET", pattern: /^orders$/, keys: [] },
  { method: "GET", pattern: /^orders\/\d{1,9}$/, keys: [] },
  { method: "POST", pattern: /^addresses$/, keys: ["name", "governorate", "city", "address", "is_default"] },
  { method: "PUT", pattern: /^addresses\/\d{1,12}$/, keys: ["name", "governorate", "city", "address", "is_default"] },
  { method: "DELETE", pattern: /^addresses\/\d{1,12}$/, keys: [] },
  { method: "GET", pattern: /^reviews$/, keys: [] },
  { method: "PUT", pattern: /^reviews$/, keys: ["product_id", "rating", "text"] },
];

/**
 * The store customer's account on the store's own host: the token stays in an httpOnly cookie and
 * goes to Laravel as X-Customer-Token. Changes must come from this store's own pages.
 */
async function handle(request: Request, context: Ctx, method: Method): Promise<NextResponse> {
  const path = ((await context.params).path ?? []).join("/");
  const route = ROUTES.find((r) => r.method === method && r.pattern.test(path));
  if (!route) return jsonError(404, "not_found");
  if (method !== "GET" && !isSameOrigin(request)) return jsonError(403, "forbidden");

  const host = visitorHost(request);
  const secure = isSecureRequest(request);
  const target = `/public/store/account${path ? `/${path}` : ""}`;

  if (method === "GET") {
    const query = new URLSearchParams({ host });
    const search = new URL(request.url).searchParams;
    for (const key of ["page", "product_id"]) {
      const value = search.get(key);
      if (value && /^\d{1,12}$/.test(value)) query.set(key, value);
    }
    const response = await relayPublic(`${target}?${query.toString()}`, { headers: customerHeaders(request) });
    // A token that no longer works (expired, signed out elsewhere) leaves the browser too.
    if (response.status === 401) clearCustomerCookie(response, secure);
    return response;
  }

  const body = method === "DELETE" ? {} : await visitorBody(request);
  if (!body) return badRequest();
  const payload = { ...pickKeys(body, route.keys), host, ip: visitorIp(request), user_agent: (request.headers.get("user-agent") ?? "").slice(0, 500) };
  const response = await relayPublic(target, { method, body: payload, headers: customerHeaders(request) });

  if (path === "verify" && response.status === 200) {
    // The token never reaches the browser's scripts.
    const json = (await response.json()) as { data: { token: string; customer: unknown } };
    const out = NextResponse.json({ data: { customer: json.data.customer } }, { headers: { "Cache-Control": "no-store" } });
    setCustomerCookie(out, json.data.token, secure);
    return out;
  }
  if (path === "sign-out" || response.status === 401) clearCustomerCookie(response, secure);
  return response;
}

export const GET = (request: Request, context: Ctx) => handle(request, context, "GET");
export const POST = (request: Request, context: Ctx) => handle(request, context, "POST");
export const PUT = (request: Request, context: Ctx) => handle(request, context, "PUT");
export const DELETE = (request: Request, context: Ctx) => handle(request, context, "DELETE");
