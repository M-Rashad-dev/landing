import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Live cart price: the server recomputes everything from the products, never from the visitor. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  return relay(
    forwardPublic("/public/store/quote", {
      method: "POST",
      body: { items: body.items, code: body.code ?? null, phone: body.phone ?? null, governorate: body.governorate ?? null, host: visitorHost(request), ip: visitorIp(request) },
    }),
  );
}
