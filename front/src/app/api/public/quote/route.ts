import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Live price for the page's product (the product comes from the page, never from the visitor). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relay(
    forwardPublic("/public/quote", {
      method: "POST",
      body: { slug: body.slug ?? "", quantity: body.quantity, options: body.options ?? {}, code: body.code ?? null, phone: body.phone ?? null, host: visitorHost(request), ip: visitorIp(request) },
    }),
  );
}
