import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Live cart price: the server recomputes everything from the products, never from the visitor. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  return relayPublic("/public/store/quote", { method: "POST", body: { ...pickKeys(body, ["items", "code", "phone", "governorate", "shipping_company_id"]), host: visitorHost(request) } });
}
