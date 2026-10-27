import { getSitemap, PUBLIC_REVALIDATE } from "@/lib/public/api";
import { parseSiteHost } from "@/lib/public/host";

export const revalidate = 60;

export function generateStaticParams(): Array<{ host: string }> {
  return [];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Published, indexable pages of the host's tenant (home on "/"), with primary-host URLs. */
export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const host = parseSiteHost((await params).host);
  const sitemap = host ? await getSitemap(host) : null;
  if (!sitemap) return new Response("Not found", { status: 404 });

  const urls = sitemap.pages
    .map((page) => `<url><loc>${escapeXml(page.url)}</loc>${page.updated_at ? `<lastmod>${escapeXml(page.updated_at)}</lastmod>` : ""}</url>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": `public, max-age=0, s-maxage=${PUBLIC_REVALIDATE}` },
  });
}
