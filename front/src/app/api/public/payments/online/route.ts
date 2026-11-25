import { badRequest, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** «ادفع أونلاين» on the pay page: a checkout at the store's own gateway; answers where to send the customer. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || typeof body.token !== "string" || !/^[a-z0-9]{12}$/.test(body.token)) return badRequest();
  const method = typeof body.method_id === "number" && Number.isInteger(body.method_id) && body.method_id > 0 ? body.method_id : undefined;
  return relayPublic("/public/payments/online", { method: "POST", body: { token: body.token, host: visitorHost(request), ...(method ? { method_id: method } : {}) } });
}
