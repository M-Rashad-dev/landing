import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Order tracking on the store: order number + phone, with the visitor IP for the rate limit. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/track", { method: "POST", body: { ...pickKeys(body, ["order_number", "phone"]), host: visitorHost(request), ip: visitorIp(request) } });
}
