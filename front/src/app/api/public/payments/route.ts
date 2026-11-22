import { badRequest, relayPublic, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/** A receipt for a prepaid order (the order's private token), with the store's host and the visitor's IP. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) return badRequest();
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  const method = form?.get("method_id");
  const sender = form?.get("sender_ref");
  const receipt = form?.get("receipt");
  if (typeof token !== "string" || !/^[a-z0-9]{12}$/.test(token) || typeof method !== "string" || !/^\d{1,10}$/.test(method) || !(receipt instanceof File) || receipt.size === 0 || receipt.size > MAX_BYTES) return badRequest();

  const body = new FormData();
  body.set("token", token);
  body.set("method_id", method);
  if (typeof sender === "string" && sender.trim()) body.set("sender_ref", sender.trim().slice(0, 80));
  body.set("receipt", receipt, receipt.name.slice(0, 200));
  body.set("host", visitorHost(request));
  const ip = visitorIp(request);
  if (ip) body.set("ip", ip);
  return relayPublic("/public/payments", { method: "POST", body });
}
