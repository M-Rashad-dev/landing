/** The platform's own pages, each at /{slug} on the platform domain (same list as Laravel's PlatformPage::SLUGS). */
export const PLATFORM_PAGE_SLUGS = ["about", "terms", "privacy", "refund-policy", "acceptable-use"] as const;
export type PlatformPageSlug = (typeof PLATFORM_PAGE_SLUGS)[number];

/** "/terms" or "/terms/" → "terms"; anything else → null. */
export function platformPageSlug(pathname: string): PlatformPageSlug | null {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  return (PLATFORM_PAGE_SLUGS as readonly string[]).includes(slug) ? (slug as PlatformPageSlug) : null;
}
