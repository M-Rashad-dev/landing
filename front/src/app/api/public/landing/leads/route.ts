import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** A phone typed on a landing page with no order yet: the store can follow it up. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/leads", {
    method: "POST",
    body: { slug: "", ...pickKeys(body, ["slug", "phone", "name", "governorate", "quantity", "form_token"]), host: visitorHost(request), ip: visitorIp(request) },
  });
}
