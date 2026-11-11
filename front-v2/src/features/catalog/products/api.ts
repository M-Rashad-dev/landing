"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";
import type { MediaItem } from "@/features/media/api";
import type { SeoAuto, SeoValue } from "../seo/seo-model";

export type StockMode = "unlimited" | "product" | "variant";
export type DisplayType = "buttons" | "dropdown" | "swatch";

export type ProductCard = {
  id: number;
  name: string;
  price: number;
  compare_at_price: number | null;
  discount_percent: number | null;
  sku: string | null;
  is_active: boolean;
  slug: string | null;
  in_store: boolean;
  is_featured: boolean;
  stock_mode: StockMode;
  stock: number | null;
  stock_total: number | null;
  low_stock_threshold: number | null;
  locked_by_plan: boolean;
  main_image: MediaItem | null;
  categories: Array<{ id: number; name: string }>;
  category_ids: number[];
  primary_category_id: number | null;
  options_count?: number;
};

export type ProductOptionValue = { id: number; label: string; color_hex: string | null; price_delta: number; is_active: boolean };
export type ProductOption = { id: number; name: string; display_type: DisplayType; is_required: boolean; values: ProductOptionValue[] };

export type ProductDetail = ProductCard & {
  description: string | null;
  short_description: string | null;
  seo: SeoValue | null;
  seo_defaults: SeoAuto;
  media: MediaItem[];
  options: ProductOption[];
  variants: Array<{ id: number; value_ids: number[]; stock: number; sku: string | null }>;
};

export const STATUSES = ["all", "active", "inactive", "out", "low"] as const;
export type Status = (typeof STATUSES)[number];
export const SORTS = ["latest", "oldest", "name", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

export type ListFilters = { q: string; status: Status; category: number | null; sort: Sort; page: number };
export type ProductPage = Paginated<ProductCard> & { meta: Paginated<ProductCard>["meta"] & { counts: Record<Status, number> } };

/** The alert when the product has none (back end: ProductList::LOW_STOCK_DEFAULT). */
export const LOW_STOCK_DEFAULT = 5;

export const productKeys = {
  all: ["products"] as const,
  list: (f: ListFilters) => ["products", "list", f] as const,
  detail: (id: number) => ["products", "detail", id] as const,
};

export function useProducts(filters: ListFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () =>
      apiPage<ProductCard>("/dashboard/products", {
        query: { q: filters.q, status: filters.status === "all" ? null : filters.status, category_id: filters.category, sort: filters.sort === "latest" ? null : filters.sort, page: filters.page, per_page: 24 },
      }) as Promise<ProductPage>,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | null) {
  return useQuery({ queryKey: productKeys.detail(id ?? 0), queryFn: () => api<ProductDetail>(`/dashboard/products/${id}`), enabled: id !== null });
}

export function useRefreshProducts() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: productKeys.all }), client.invalidateQueries({ queryKey: ["categories"] })]);
}

export type QuickInput = Partial<{ name: string; price: string; category_ids: number[]; primary_category_id: number | null; stock_mode: "unlimited" | "product"; stock: number }>;

export const quickUpdate = (id: number, body: QuickInput) => api<ProductCard>(`/dashboard/products/${id}/quick`, { method: "PATCH", body });
export const toggleProduct = (id: number) => api<ProductCard>(`/dashboard/products/${id}/toggle`, { method: "POST" });
export const duplicateProduct = (id: number) => api<ProductDetail>(`/dashboard/products/${id}/duplicate`, { method: "POST" });
export const deleteProduct = (id: number) => api<void>(`/dashboard/products/${id}`, { method: "DELETE" });
export const saveProduct = (id: number | null, body: unknown) => api<ProductDetail>(id ? `/dashboard/products/${id}` : "/dashboard/products", { method: id ? "PUT" : "POST", body });

export type BulkAction = "activate" | "deactivate" | "delete" | "add_category" | "remove_category";
export const bulkProducts = (action: BulkAction, ids: number[], categoryId?: number) =>
  api<{ done: number; skipped: Array<{ id: number; name: string }> }>("/dashboard/products/bulk", { method: "POST", body: { action, ids, category_id: categoryId ?? null } });

/** Stock state of a card. */
export function stockState(p: Pick<ProductCard, "stock_mode" | "stock_total" | "low_stock_threshold">): "untracked" | "out" | "low" | "ok" {
  if (p.stock_mode === "unlimited" || p.stock_total === null) return "untracked";
  if (p.stock_total <= 0) return "out";
  return p.stock_total <= (p.low_stock_threshold ?? LOW_STOCK_DEFAULT) ? "low" : "ok";
}
