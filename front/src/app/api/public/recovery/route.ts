import { badRequest, relayPublic, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** A cart reminder's link on the store: the lines to refill and the customer's details (this store's own links only). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{24}$/.test(token)) return badRequest();
  return relayPublic(`/public/recovery?token=${token}&host=${encodeURIComponent(visitorHost(request))}`);
}
