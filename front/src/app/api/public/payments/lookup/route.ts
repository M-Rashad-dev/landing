import { badRequest, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** The pay page of a prepaid order: its private token and the store's host; ref = back from the store's gateway (settled there). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || typeof body.token !== "string" || !/^[a-z0-9]{12}$/.test(body.token)) return badRequest();
  const ref = typeof body.ref === "string" && /^[A-Za-z0-9]{1,60}$/.test(body.ref) ? body.ref : undefined;
  return relayPublic("/public/payments/lookup", { method: "POST", body: { token: body.token, host: visitorHost(request), ...(ref ? { ref } : {}) } });
}
