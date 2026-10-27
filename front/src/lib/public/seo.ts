import type { Metadata } from "next";
import { bestUnitOffer } from "@/lib/price/offers";
import { validTracking } from "@/lib/tracking/ids";
import { resolveColors } from "@/lib/identity/style";
import type { PublicPagePayload } from "./types";

/** Absolute URL for a path served on the page's canonical origin (media are relative "/media/..."). */
export function absoluteUrl(path: string | null | undefined, canonical: string): string | undefined {
  if (!path) return undefined;
  try {
    return new URL(path, canonical).toString();
  } catch {
    return undefined;
  }
}

export function buildMetadata(data: PublicPagePayload): Metadata {
  const { seo, identity } = data;
  const tracking = validTracking(data.tracking);
  const og = absoluteUrl(seo.og_image?.url, seo.canonical);
  const verification: Record<string, string> = {};
  if (tracking.facebook_domain_verification) verification["facebook-domain-verification"] = tracking.facebook_domain_verification;

  return {
    // The page title is final (suffix already applied by the back end).
    title: { absolute: seo.title || data.page.title },
    // null (not undefined) so the platform's own description is never inherited.
    description: seo.description || null,
    alternates: { canonical: seo.canonical },
    robots: seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "ar_EG",
      url: seo.canonical,
      siteName: seo.site_name ?? undefined,
      title: seo.title,
      description: seo.description || undefined,
      images: og ? [{ url: og, width: seo.og_image?.width || undefined, height: seo.og_image?.height || undefined, alt: seo.og_image?.alt ?? undefined }] : undefined,
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description || undefined, images: og ? [og] : undefined },
    icons: identity?.favicon
      ? {
          icon: [{ url: identity.favicon.icon32, sizes: "32x32", type: "image/png" }],
          apple: [{ url: identity.favicon.icon180, sizes: "180x180", type: "image/png" }],
        }
      : undefined,
    verification: {
      google: tracking.google_site_verification,
      other: Object.keys(verification).length > 0 ? verification : undefined,
    },
  };
}

export function themeColor(data: PublicPagePayload): string {
  return resolveColors({ ...data.identity?.colors, ...data.content?.design?.colors }).primary;
}

/** Plain text from the Markdown subset used in descriptions. */
export function stripMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return "";
  return markdown
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/(^|[^\p{L}\p{N}])[*_]|[*_](?=[^\p{L}\p{N}]|$)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** schema.org Product with the price after the best active offer. */
export function productJsonLd(data: PublicPagePayload, now = Date.now()): Record<string, unknown> | null {
  const product = data.product;
  if (!product) return null;
  const best = bestUnitOffer(data.offers, product);
  const price = best ? best.unit : product.price;
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url: data.seo.canonical,
    price: price.toFixed(2),
    priceCurrency: "EGP",
    availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
  if (best?.offer.ends_at && new Date(best.offer.ends_at).getTime() > now) offer.priceValidUntil = best.offer.ends_at.slice(0, 10);

  const images = product.images.map((image) => absoluteUrl(image.urls.large, data.seo.canonical)).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: stripMarkdown(product.description).slice(0, 5000) || undefined,
    image: images.length > 0 ? images : undefined,
    brand: data.identity?.brand_name ? { "@type": "Brand", name: data.identity.brand_name } : undefined,
    offers: offer,
  };
}

/** JSON for a <script type="application/ld+json">; "<" is escaped so user text can never close the tag. */
export function jsonLdString(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
