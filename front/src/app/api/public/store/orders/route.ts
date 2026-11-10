import { badRequest, forwardPublic, relay, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

const ALLOWED = ["items", "customer", "code", "form_token", "website", "utm"] as const;

/** Store checkout: the allowed fields + host, client IP and user agent (trusted by Laravel through the internal key). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body || !Array.isArray(body.items)) return badRequest();
  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED) if (key in body) payload[key] = body[key];
  payload.host = visitorHost(request);
  payload.ip = visitorIp(request);
  payload.user_agent = (request.headers.get("user-agent") ?? "").slice(0, 500);
  return relay(forwardPublic("/public/store/orders", { method: "POST", body: payload }));
}
