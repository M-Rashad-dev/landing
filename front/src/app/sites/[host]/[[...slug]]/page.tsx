import type { Metadata, Viewport } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { getPublicPage, resolveHost } from "@/lib/public/api";
import { parseSiteHost, pathForSlug, primaryRedirectUrl, slugFromSegments } from "@/lib/public/host";
import { buildMetadata, jsonLdString, productJsonLd, themeColor } from "@/lib/public/seo";
import { validTracking } from "@/lib/tracking/ids";
import { TrackingScripts } from "@/lib/tracking/tracking-scripts";
import { IdentityFonts } from "@/themes/shared/identity-fonts";
import { IdentityStyle } from "@/themes/shared/identity-style";
import { SiteRenderer } from "@/themes/site-renderer";
import type { PageContext } from "@/themes/types";
import { SuspendedStore } from "../suspended";

/** ISR: pages are cached per host/slug and refreshed by tag on publish/edit (or after 60 s). */
export const revalidate = 60;

/** No page is known at build time; each host/slug is rendered on first visit, then cached (ISR). */
export function generateStaticParams(): Array<{ host: string; slug?: string[] }> {
  return [];
}

type Params = Promise<{ host: string; slug?: string[] }>;

async function load(params: Params) {
  const { host: rawHost, slug: segments } = await params;
  const host = parseSiteHost(rawHost);
  const slug = slugFromSegments(segments);
  if (!host || slug === null) notFound();

  const site = await resolveHost(host);
  if (!site) notFound();
  if (site.status === "suspended") return { host, slug, site, data: null };

  if (!site.is_primary) {
    // Built from env, not request headers, so the route stays static (ISR).
    const env = serverEnv();
    permanentRedirect(primaryRedirectUrl(site.primary_host, pathForSlug(slug), { scheme: env.publicScheme, port: env.publicPort }));
  }

  const data = await getPublicPage(host, slug);
  if (!data) notFound();
  return { host, slug, site, data };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { data } = await load(params);
  if (!data) return { title: { absolute: "—" }, robots: { index: false, follow: false } };
  return buildMetadata(data);
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { data } = await load(params);
  return { width: "device-width", initialScale: 1, themeColor: data ? themeColor(data) : undefined };
}

export default async function PublicSitePage({ params }: { params: Params }) {
  const { host, data } = await load(params);
  if (!data) return <SuspendedStore />;
  if (!data.identity) notFound();

  const tracking = validTracking(data.tracking);
  const ctx: PageContext = {
    host,
    isPreview: false,
    identity: data.identity,
    product: data.product,
    offers: data.offers,
    page: { id: data.page.id, slug: data.page.slug, title: data.page.title },
    media: data.media ?? {},
    conversionEvent: tracking.conversion_event,
  };
  const jsonLd = productJsonLd(data);

  return (
    <>
      <IdentityFonts heading={data.identity.font_heading} body={data.identity.font_body} />
      <IdentityStyle identity={data.identity} className="min-h-dvh">
        <SiteRenderer themeKey={data.theme_key} sections={data.content.sections} ctx={ctx} />
      </IdentityStyle>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} /> : null}
      <TrackingScripts tracking={tracking} product={data.product ? { id: data.product.id, name: data.product.name, price: data.product.price } : null} />
    </>
  );
}
