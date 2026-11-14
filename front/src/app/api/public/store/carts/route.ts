import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** The visitor's cart changed: kept as an abandoned cart until it is ordered (empty removes it). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  return relayPublic("/public/store/carts", {
    method: "POST",
    body: { ...pickKeys(body, ["cart_token", "items", "phone", "name"]), host: visitorHost(request), ip: visitorIp(request) },
  });
}
