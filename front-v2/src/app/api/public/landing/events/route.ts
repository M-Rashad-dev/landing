import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Landing page counters (visit, order form started). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/events", { method: "POST", body: { slug: null, ...pickKeys(body, ["slug", "type", "utm_source", "referrer", "device"]), host: visitorHost(request), ip: visitorIp(request) } });
}
