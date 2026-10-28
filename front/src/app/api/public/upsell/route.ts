import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** One-click post-order offer: the signed token from the order response proves the order is the visitor's. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relay(
    forwardPublic("/public/upsell", {
      method: "POST",
      body: { order_number: body.order_number, upsell_id: body.upsell_id, token: body.token, host: visitorHost(request), ip: visitorIp(request) },
    }),
  );
}
