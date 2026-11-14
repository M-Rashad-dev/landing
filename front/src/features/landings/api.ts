"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export const PAGE_TABS = ["all", "published", "draft"] as const;
export type PageTab = (typeof PAGE_TABS)[number];

export type LandingRow = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  theme_key: string;
  product_id: number | null;
  product: { id: number; name: string; is_active: boolean; image: Record<string, string> | null } | null;
  has_unpublished_changes: boolean;
  locked_by_plan: boolean;
  published_at: string | null;
  updated_at: string | null;
  stats?: { views: number; orders: number; conversion: number | null };
};

type LandingPage = Paginated<LandingRow> & { meta: Paginated<LandingRow>["meta"] & { counts: Record<PageTab, number> } };

export function useLandings(f: { q: string; tab: PageTab; page: number }) {
  return useQuery({
    queryKey: ["landings", "list", f],
    queryFn: () => apiPage<LandingRow>("/dashboard/pages", { query: { q: f.q, status: f.tab === "all" ? null : f.tab, page: f.page, per_page: 24 } }) as Promise<LandingPage>,
    placeholderData: keepPreviousData,
  });
}

export function useRefreshLandings() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["landings"] });
}

export const createLanding = (body: { title: string; slug: string; theme_key: string; product_id: number }) => api<LandingRow>("/dashboard/pages", { method: "POST", body });
export const publishLanding = (id: number) => api<LandingRow>(`/dashboard/pages/${id}/publish`, { method: "POST" });
export const unpublishLanding = (id: number) => api<LandingRow>(`/dashboard/pages/${id}/unpublish`, { method: "POST" });
export const duplicateLanding = (id: number) => api<LandingRow>(`/dashboard/pages/${id}/duplicate`, { method: "POST" });
export const deleteLanding = (id: number) => api<void>(`/dashboard/pages/${id}`, { method: "DELETE" });

/* ---------- landing themes (the theme store, landing kind) ---------- */

export type ThemePrice = { original: number; final: number; discount_percent: number; discount_ends_at: string | null };

export type LandingTheme = {
  key: string;
  name: string;
  kind: "landing" | "store";
  short_description: string | null;
  price: ThemePrice | null;
  is_free: boolean;
  is_featured: boolean;
  is_new: boolean;
  cover: Record<string, string> | null;
  tags: Array<{ id: number; slug: string; name: string }>;
  min_plan: { key: string; name: string } | null;
  owned?: boolean;
  can_publish?: boolean;
  description?: string | null;
  features?: string[];
  images?: Array<{ id: number; kind: "cover" | "desktop" | "mobile"; urls: Record<string, string>; width: number; height: number }>;
};

export const useLandingThemes = () => useQuery({ queryKey: ["landings", "themes"], queryFn: () => api<LandingTheme[]>("/dashboard/theme-store", { query: { kind: "landing" } }) });
export const useLandingTheme = (key: string) => useQuery({ queryKey: ["landings", "theme", key], queryFn: () => api<LandingTheme>(`/dashboard/theme-store/${encodeURIComponent(key)}`) });

/** The page's public address on the store's domain. */
export const pageUrl = (storeUrl: string | null, slug: string) => (storeUrl ? `${storeUrl.replace(/\/$/, "")}/${encodeURIComponent(slug)}` : null);
