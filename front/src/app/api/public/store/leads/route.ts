import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Abandoned checkout: the phone and the cart so the store can follow up. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  return relay(
    forwardPublic("/public/store/leads", {
      method: "POST",
      body: {
        items: body.items,
        phone: body.phone,
        name: body.name ?? null,
        governorate: body.governorate ?? null,
        form_token: body.form_token,
        host: visitorHost(request),
        ip: visitorIp(request),
      },
    }),
  );
}
