import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Customer order tracking on the store's site: order number + phone, with the visitor IP for the rate limit. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relay(
    forwardPublic("/public/track", {
      method: "POST",
      body: { order_number: body.order_number, phone: body.phone, host: visitorHost(request), ip: visitorIp(request) },
    }),
  );
}
