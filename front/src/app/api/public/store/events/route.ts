import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Store traffic counters (views, product views, add to cart, checkout). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/store/events", { method: "POST", body: { ...pickKeys(body, ["type", "utm_source", "referrer", "device"]), host: visitorHost(request) } });
}
