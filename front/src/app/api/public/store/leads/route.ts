import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Checkout started with a phone but not confirmed: the store can follow it up. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  return relayPublic("/public/store/leads", {
    method: "POST",
    body: { ...pickKeys(body, ["items", "phone", "name", "governorate", "form_token", "cart_token"]), host: visitorHost(request), ip: visitorIp(request) },
  });
}
