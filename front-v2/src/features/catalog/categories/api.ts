"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { MediaUrls } from "@/features/media/api";
import type { SeoAuto, SeoValue } from "../seo/seo-model";

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
  seo: SeoValue | null;
  position: number;
  products_count: number;
  locked_by_plan: boolean;
  seo_defaults: SeoAuto;
};

export type CategoryInput = {
  name: string;
  parent_id: number | null;
  slug: string | null;
  description: string | null;
  media_id: number | null;
  is_visible: boolean;
  seo: SeoValue | null;
};

/** Back end: landing.limits.category_depth. */
export const MAX_DEPTH = 5;

export const categoryKeys = { all: ["categories"] as const };

/** The whole tree, parents before children, in display order. */
export function useCategories(enabled = true) {
  return useQuery({ queryKey: categoryKeys.all, queryFn: () => api<Category[]>("/dashboard/categories"), enabled });
}

export function useRefreshCategories() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: categoryKeys.all }), client.invalidateQueries({ queryKey: ["products"] })]);
}

export const createCategory = (body: Partial<CategoryInput> & { name: string }) => api<Category>("/dashboard/categories", { method: "POST", body });
export const updateCategory = (id: number, body: Partial<CategoryInput>) => api<Category>(`/dashboard/categories/${id}`, { method: "PUT", body });
export const deleteCategory = (id: number, children: "lift" | "delete") => api<void>(`/dashboard/categories/${id}`, { method: "DELETE", query: { children } });
export const reorderCategories = (ids: number[]) => api<void>("/dashboard/categories/order", { method: "PUT", body: { ids } });

/* ---------- tree helpers ---------- */

export function childrenOf(list: Category[], parentId: number | null): Category[] {
  return list.filter((c) => c.parent_id === parentId).sort((a, b) => a.position - b.position || a.id - b.id);
}

/** The category and every category under it. */
export function descendantIds(list: Category[], id: number): number[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const c of list) if (c.parent_id === out[i]) out.push(c.id);
  return out;
}

/** "ملابس › رجالي" for the parents of a category (nearest last). */
export function pathOf(list: Category[], category: Category): string {
  const names: string[] = [];
  for (let p = list.find((c) => c.id === category.parent_id); p; p = list.find((c) => c.id === p!.parent_id)) names.unshift(p.name);
  return names.join(" › ");
}

/** Levels under a category (0 = no children). */
export function subtreeHeight(list: Category[], id: number): number {
  const kids = list.filter((c) => c.parent_id === id);
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => subtreeHeight(list, k.id)));
}
