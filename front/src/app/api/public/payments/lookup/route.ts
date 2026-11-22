import { badRequest, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** The pay page of a prepaid order: its private token and the store's host. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || typeof body.token !== "string" || !/^[a-z0-9]{12}$/.test(body.token)) return badRequest();
  return relayPublic("/public/payments/lookup", { method: "POST", body: { token: body.token, host: visitorHost(request) } });
}
