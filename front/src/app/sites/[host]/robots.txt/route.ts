import { serverEnv } from "@/lib/env";
import { resolveHost } from "@/lib/public/api";
import { parseSiteHost, primaryRedirectUrl } from "@/lib/public/host";

export const revalidate = 60;

export function generateStaticParams(): Array<{ host: string }> {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const host = parseSiteHost((await params).host);
  const site = host ? await resolveHost(host) : null;
  if (!site) return new Response("Not found", { status: 404 });

  const env = serverEnv();
  const body =
    site.status === "suspended"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\n\nSitemap: ${primaryRedirectUrl(site.primary_host, "/sitemap.xml", { scheme: env.publicScheme, port: env.publicPort })}\n`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
