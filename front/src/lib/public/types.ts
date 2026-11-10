import type { Tracking } from "@/lib/tracking/ids";
import type { PageContent, PageContext } from "@/themes/types";

/** GET /public/resolve-host */
export type ResolvedHost = {
  host: string;
  status: "active" | "suspended";
  tenant_active: boolean;
  primary_host: string;
  is_primary: boolean;
  home_slug: string | null;
};

export type PublicSeo = {
  title: string;
  description: string;
  og_image: { url: string | null; width: number; height: number; alt: string | null } | null;
  canonical: string;
  noindex: boolean;
  site_name: string | null;
};

/** GET /public/pages — published snapshot only. */
export type PublicPagePayload = {
  page: { id: number; slug: string; title: string; is_home: boolean; theme_key: string; published_at: string | null };
  theme_key: string;
  content: PageContent;
  identity: PageContext["identity"] | null;
  product: PageContext["product"];
  offers: PageContext["offers"];
  media: PageContext["media"];
  seo: PublicSeo;
  tracking: Tracking;
  shipping?: PageContext["shipping"];
  /** Show the "made with" platform badge (the plan does not remove it). */
  branding?: boolean;
};

/** GET /public/sitemap */
export type PublicSitemap = {
  primary_host: string;
  pages: Array<{ slug: string; url: string; updated_at: string | null }>;
};
