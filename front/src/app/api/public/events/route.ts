import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Page visit / order-form start counters for the store's analytics. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relay(
    forwardPublic("/public/events", {
      method: "POST",
      body: {
        slug: body.slug ?? null,
        type: body.type,
        utm_source: body.utm_source ?? null,
        referrer: body.referrer ?? null,
        device: body.device ?? null,
        ab: body.ab ?? null,
        host: visitorHost(request),
        ip: visitorIp(request),
      },
    }),
  );
}
