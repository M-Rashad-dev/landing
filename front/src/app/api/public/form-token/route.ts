import { forwardPublic, relay, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** Anti-bot token for the order form of a page on this host. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const query = new URLSearchParams({ host: visitorHost(request), slug: slug.slice(0, 100) });
  // The visitor IP keys Laravel's 30-per-minute limit.
  const ip = visitorIp(request);
  if (ip) query.set("ip", ip);
  return relay(forwardPublic(`/public/form-token?${query.toString()}`));
}
