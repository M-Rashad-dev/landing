import type { ProductPage } from "@/lib/store/types";

/** Absolute URL of a path served on the store's origin (media are relative "/media/..."). */
export function absoluteUrl(path: string | null | undefined, base: string): string | undefined {
  if (!path) return undefined;
  try {
    return new URL(path, base).toString();
  } catch {
    return undefined;
  }
}

/** Plain text from the Markdown used in descriptions. */
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

/** schema.org Product for a product page (Google shows price and stock in results). */
export function productJsonLd(page: ProductPage, canonical: string, brand: string): Record<string, unknown> {
  const { product } = page;
  const images = product.images.map((image) => absoluteUrl(image.urls.large ?? Object.values(image.urls)[0], canonical)).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: stripMarkdown(product.description ?? product.short_description).slice(0, 5000) || undefined,
    image: images.length > 0 ? images : undefined,
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      price: product.price.toFixed(2),
      priceCurrency: "EGP",
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}

const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");
const escaped = (code: string) => `${String.fromCharCode(92)}u${code}`;

/** JSON for a <script type="application/ld+json">: "<" is escaped so store text can never close the tag. */
export function jsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, escaped("003c")).replace(LINE_SEPARATOR, escaped("2028")).replace(PARAGRAPH_SEPARATOR, escaped("2029"));
}
