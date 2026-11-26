import { badRequest, customerHeaders, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Checkout: the allowed fields plus host, IP and user agent (Laravel trusts them through the internal key). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  return relayPublic("/public/store/orders", {
    method: "POST",
    body: {
      ...pickKeys(body, ["items", "customer", "code", "shipping_company_id", "form_token", "website", "utm", "cart_token", "save_address"]),
      host: visitorHost(request),
      ip: visitorIp(request),
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 500),
    },
    // A signed-in customer orders on their own phone.
    headers: customerHeaders(request),
  });
}
