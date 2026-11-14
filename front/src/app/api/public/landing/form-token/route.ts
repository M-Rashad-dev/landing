import { relayPublic, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Anti-bot token for the order form of a landing page on this host. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const query = new URLSearchParams({ host: visitorHost(request), slug: slug.slice(0, 100) });
  const ip = visitorIp(request);
  if (ip) query.set("ip", ip);
  return relayPublic(`/public/form-token?${query.toString()}`);
}
