"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { Tracking } from "@/lib/tracking/ids";
import type { PageContent, PageContext, PageKind, StoreSectionData } from "@/themes/types";

export type PageStatus = "draft" | "published";

export type PageSummary = {
  /** Above the plan limit after a downgrade: kept, not served to visitors. */
  locked_by_plan?: boolean;
  id: number;
  /** A store home is the store's "/" (edited here, shown only through the store). */
  kind: PageKind;
  title: string;
  slug: string;
  status: PageStatus;
  theme_key: string;
  identity_id: number;
  product_id: number | null;
  identity?: { id: number; name: string } | null;
  product?: { id: number; name: string; is_active: boolean } | null;
  is_home: boolean;
  has_unpublished_changes: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SeoOverride = { title: string | null; description: string | null; og_media_id: number | null; noindex: boolean };

export type PageDetail = PageSummary & {
  draft_content: PageContent;
  version: number;
  published_theme_key: string | null;
  seo_override: SeoOverride | null;
  tracking_override: Tracking | null;
};

export type PreviewData = {
  page: PageContext["page"];
  theme_key: string;
  content: PageContent;
  identity: PageContext["identity"] | null;
  product: PageContext["product"];
  offers: PageContext["offers"];
  media: PageContext["media"];
  shipping?: PageContext["shipping"];
  store?: StoreSectionData | null;
};

export type Blocker = { code: string; message: string };

export const pageKeys = {
  all: ["pages"] as const,
  list: (p: object) => ["pages", "list", p] as const,
  detail: (id: number) => ["pages", id] as const,
};

export function usePages(params: { q?: string; status?: string; page?: number }) {
  const query = { q: params.q ?? "", status: params.status ?? "", page: params.page ?? 1 };
  return useQuery({
    queryKey: pageKeys.list(query),
    queryFn: ({ signal }) => apiPage<PageSummary>("/dashboard/pages", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export const createPage = (body: { title: string; slug: string; theme_key: string; identity_id: number | null; product_id: number | null; content: PageContent }) =>
  api<PageDetail>("/dashboard/pages", { method: "POST", body });

export const updatePage = (id: number, body: Record<string, unknown>) => api<PageDetail>(`/dashboard/pages/${id}`, { method: "PUT", body });
export const savePageContent = (id: number, body: { version: number; content: PageContent; theme_key?: string }) => api<PageDetail>(`/dashboard/pages/${id}/content`, { method: "PUT", body });
export const publishPage = (id: number) => api<PageDetail>(`/dashboard/pages/${id}/publish`, { method: "POST" });
export const unpublishPage = (id: number) => api<PageDetail>(`/dashboard/pages/${id}/unpublish`, { method: "POST" });
export const duplicatePage = (id: number) => api<PageDetail>(`/dashboard/pages/${id}/duplicate`, { method: "POST" });
export const setHomePage = (id: number) => api<PageDetail>(`/dashboard/pages/${id}/set-home`, { method: "POST" });
export const deletePage = (id: number) => api<void>(`/dashboard/pages/${id}`, { method: "DELETE" });
export const fetchPage = (id: number) => api<PageDetail>(`/dashboard/pages/${id}`);

/** Lowercase, arabic-friendly slug from a title. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "") // Arabic diacritics
    .replace(/[^a-z0-9ء-ي٠-٩۰-۹]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
}
