import { liveStore } from "@/lib/public/store";

export const dynamic = "force-dynamic";

/** Search engines may read the store, not its cart, checkout and tracking. */
export async function GET(_request: Request, context: { params: Promise<{ host: string }> }) {
  const { config } = await liveStore((await context.params).host);
  const sitemap = new URL("/sitemap.xml", config.seo.canonical).toString();
  const body = ["User-agent: *", "Allow: /", "Disallow: /cart", "Disallow: /checkout", "Disallow: /track", "", `Sitemap: ${sitemap}`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
