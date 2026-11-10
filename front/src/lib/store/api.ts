"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { MediaUrls } from "@/lib/types";
import type { PageContent } from "@/themes/types";

/* ---------- Types (back: Dashboard\StoreController, CategoryController, StorePageController) ---------- */

export type MenuType = "home" | "all_products" | "category" | "product" | "page" | "landing" | "url";

export type MenuItem = { type: MenuType; label: string; target_id?: number | null; url?: string | null; children?: MenuItem[] };

export type StoreSettings = { announcement: string | null; products_per_page: number; show_whatsapp: boolean; show_out_of_stock: boolean };

export type StoreSeo = { title?: string | null; description?: string | null; og_media_id?: number | null } | null;

export type DashboardStore =
  | { exists: false; live: false }
  | {
      exists: true;
      is_enabled: boolean;
      live: boolean;
      theme_key: string;
      home: { id: number; status: "draft" | "published"; published_at: string | null; has_unpublished_changes: boolean } | null;
      settings: StoreSettings;
      menus: { header: MenuItem[]; footer: MenuItem[] };
      seo: StoreSeo;
      counts: { products: number; categories: number };
    };

export type Category = {
  id: number;
  parent_id: number | null;
  depth: number;
  name: string;
  slug: string;
  description: string | null;
  media_id: number | null;
  image: MediaUrls | null;
  is_visible: boolean;
  seo: { title?: string | null; description?: string | null } | null;
  position: number;
  products_count: number;
  locked_by_plan: boolean;
};

export type CategoryPayload = {
  name: string;
  slug: string | null;
  parent_id: number | null;
  description: string | null;
  media_id: number | null;
  is_visible: boolean;
  seo: { title: string | null; description: string | null } | null;
};

export type StorePage = { id: number; title: string; slug: string; body: string | null; is_published: boolean; seo: { title?: string | null; description?: string | null } | null; position: number };

export type StorePagePayload = { title: string; slug: string | null; body: string | null; is_published: boolean; seo: { title: string | null; description: string | null } | null };

export type StoreAnalytics = {
  from: string;
  to: string;
  totals: { views: number; product_views: number; add_to_cart: number; checkouts: number; orders: number; revenue: number; conversion: number | null };
  days: Array<{ date: string; views: number; product_views: number; add_to_cart: number; checkouts: number; orders: number; revenue: number }>;
  sources: Array<{ source: string; views: number }>;
  top_products: Array<{ product_id: number | null; name: string; units: number; revenue: number }>;
};

/* ---------- Queries ---------- */

export const storeKeys = {
  store: ["store"] as const,
  categories: ["store", "categories"] as const,
  pages: ["store", "pages"] as const,
  analytics: (range: string) => ["store", "analytics", range] as const,
};

export function useStore(enabled = true) {
  return useQuery({ queryKey: storeKeys.store, queryFn: ({ signal }) => api<DashboardStore>("/dashboard/store", { signal }), enabled });
}

export function useCategories(enabled = true) {
  return useQuery({ queryKey: storeKeys.categories, queryFn: ({ signal }) => api<Category[]>("/dashboard/categories", { signal }), enabled });
}

export function useStorePages(enabled = true) {
  return useQuery({ queryKey: storeKeys.pages, queryFn: ({ signal }) => api<StorePage[]>("/dashboard/store-pages", { signal }), enabled });
}

export function useStoreAnalytics(from: string, to: string) {
  return useQuery({ queryKey: storeKeys.analytics(`${from}:${to}`), queryFn: ({ signal }) => api<StoreAnalytics>("/dashboard/store/analytics", { query: { from, to }, signal }) });
}

/* ---------- Mutations ---------- */

export const setupStore = (content: PageContent) => api<DashboardStore>("/dashboard/store/setup", { method: "POST", body: { content } });

export const updateStore = (body: Partial<{ is_enabled: boolean; theme_key: string; settings: StoreSettings; menus: { header: MenuItem[]; footer: MenuItem[] }; seo: StoreSeo }>) =>
  api<DashboardStore>("/dashboard/store", { method: "PUT", body });

export const saveCategory = (payload: CategoryPayload, id?: number) =>
  id ? api<Category>(`/dashboard/categories/${id}`, { method: "PUT", body: payload }) : api<Category>("/dashboard/categories", { method: "POST", body: payload });

export const deleteCategory = (id: number) => api<void>(`/dashboard/categories/${id}`, { method: "DELETE" });

export const reorderCategories = (ids: number[]) => api<void>("/dashboard/categories/order", { method: "PUT", body: { ids } });

export const saveStorePage = (payload: StorePagePayload, id?: number) =>
  id ? api<StorePage>(`/dashboard/store-pages/${id}`, { method: "PUT", body: payload }) : api<StorePage>("/dashboard/store-pages", { method: "POST", body: payload });

export const deleteStorePage = (id: number) => api<void>(`/dashboard/store-pages/${id}`, { method: "DELETE" });
