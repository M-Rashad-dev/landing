import { relayPublic, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Anti-bot token for the checkout of this store. */
export async function GET(request: Request) {
  const query = new URLSearchParams({ host: visitorHost(request) });
  const ip = visitorIp(request);
  if (ip) query.set("ip", ip);
  return relayPublic(`/public/store/form-token?${query.toString()}`);
}
