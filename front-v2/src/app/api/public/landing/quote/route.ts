import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Live price of a landing page's product (the product comes from the page, never from the visitor). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/quote", {
    method: "POST",
    body: { slug: "", options: {}, ...pickKeys(body, ["slug", "quantity", "options", "code", "phone", "governorate", "offer_id", "shipping_company_id"]), host: visitorHost(request) },
  });
}
