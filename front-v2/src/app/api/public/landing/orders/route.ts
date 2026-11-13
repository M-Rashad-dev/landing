import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** An order from a landing page: the allowed fields plus host, IP and user agent (Laravel trusts them through the internal key). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/orders", {
    method: "POST",
    body: {
      slug: "",
      ...pickKeys(body, ["slug", "quantity", "options", "code", "customer", "form_token", "website", "utm", "offer_id", "shipping_company_id", "idempotency_key"]),
      host: visitorHost(request),
      ip: visitorIp(request),
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 500),
    },
  });
}
