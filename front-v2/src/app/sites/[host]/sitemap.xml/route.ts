import { notFound } from "next/navigation";
import { publicGet } from "@/lib/public/fetch";
import { liveStore } from "@/lib/public/store";

export const dynamic = "force-dynamic";

type Sitemap = { primary_host: string; pages: Array<{ slug: string; url: string; updated_at: string | null }> };

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Every public URL of the store (home, products, categories, pages), from the back end. */
export async function GET(_request: Request, context: { params: Promise<{ host: string }> }) {
  const { host } = await liveStore((await context.params).host);
  const sitemap = (await publicGet<Sitemap>("sitemap", host))?.data;
  if (!sitemap) notFound();
  const urls = sitemap.pages.map((p) => `  <url><loc>${escapeXml(p.url)}</loc>${p.updated_at ? `<lastmod>${escapeXml(p.updated_at)}</lastmod>` : ""}</url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
