import { badRequest, forwardPublic, relay, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Store traffic counters (views, product views, add to cart, checkout). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relay(
    forwardPublic("/public/store/events", {
      method: "POST",
      body: { type: body.type, utm_source: body.utm_source ?? null, referrer: body.referrer ?? null, device: body.device ?? null, host: visitorHost(request) },
    }),
  );
}
