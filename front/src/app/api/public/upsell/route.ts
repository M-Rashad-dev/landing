import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** One click on the thank-you screen (store or landing page): adds the offer to the order just placed. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/upsell", {
    method: "POST",
    body: { ...pickKeys(body, ["order_number", "upsell_id", "token"]), host: visitorHost(request), ip: visitorIp(request) },
  });
}
