import { forwardPublic, relay, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Anti-bot token for the store checkout of this host. */
export async function GET(request: Request) {
  const query = new URLSearchParams({ host: visitorHost(request) });
  const ip = visitorIp(request);
  if (ip) query.set("ip", ip);
  return relay(forwardPublic(`/public/store/form-token?${query.toString()}`));
}
