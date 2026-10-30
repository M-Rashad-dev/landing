import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Abandoned order form: the phone (and what else was typed) so the store can follow up. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relay(
    forwardPublic("/public/leads", {
      method: "POST",
      body: {
        slug: body.slug ?? null,
        phone: body.phone,
        name: body.name ?? null,
        governorate: body.governorate ?? null,
        quantity: body.quantity ?? null,
        form_token: body.form_token,
        host: visitorHost(request),
        ip: visitorIp(request),
      },
    }),
  );
}
