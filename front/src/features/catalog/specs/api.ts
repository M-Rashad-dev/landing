"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

/** Back end: config landing.limits (spec_rows, spec_tables, spec_card_rows). */
export const MAX_ROWS = 40;
export const MAX_TABLES = 6;
export const MAX_CARD_ROWS = 4;

/** A row of a group: a label and its two flags (copied into products). */
export type SpecGroupRow = { label: string; in_card: boolean; filterable: boolean };
export type SpecGroupSummary = { id: number; name: string; rows_count: number; products_count: number };
export type SpecGroup = { id: number; name: string; rows: SpecGroupRow[]; products_count: number };
export type SpecGroupInput = { name: string; rows: SpecGroupRow[] };

/** A product's spec table (product form). */
export type ProductSpecRow = SpecGroupRow & { value: string | null };
export type ProductSpecTable = { id?: number; spec_group_id: number | null; name: string; rows: ProductSpecRow[] };

/** «املأ القيم»: a product and its values by the group's labels. */
export type GridRow = { product_id: number; name: string; image: string | null; values: Record<string, string | null> };
export type GridPage = Paginated<GridRow> & { meta: Paginated<GridRow>["meta"] & { labels: string[] } };

export const specKeys = {
  all: ["spec-groups"] as const,
  list: ["spec-groups", "list"] as const,
  detail: (id: number) => ["spec-groups", "detail", id] as const,
  grid: (id: number, page: number) => ["spec-groups", "grid", id, page] as const,
};

export function useSpecGroups() {
  return useQuery({ queryKey: specKeys.list, queryFn: () => apiPage<SpecGroupSummary>("/dashboard/spec-groups") as Promise<Paginated<SpecGroupSummary> & { meta: { max: number } }> });
}

export function useSpecGroup(id: number | null) {
  return useQuery({ queryKey: specKeys.detail(id ?? 0), queryFn: () => api<SpecGroup>(`/dashboard/spec-groups/${id}`), enabled: id !== null });
}

export function useSpecGrid(id: number, page: number) {
  return useQuery({ queryKey: specKeys.grid(id, page), queryFn: () => apiPage<GridRow>(`/dashboard/spec-groups/${id}/grid`, { query: { page } }) as Promise<GridPage>, placeholderData: keepPreviousData });
}

/** Groups and products both change when a group is applied, pushed or filled. */
export function useRefreshSpecs() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: specKeys.all }), client.invalidateQueries({ queryKey: ["products"] })]);
}

export const createSpecGroup = (body: SpecGroupInput) => api<SpecGroup>("/dashboard/spec-groups", { method: "POST", body });
export const updateSpecGroup = (id: number, body: SpecGroupInput) => api<SpecGroup>(`/dashboard/spec-groups/${id}`, { method: "PUT", body });
export const deleteSpecGroup = (id: number) => api<void>(`/dashboard/spec-groups/${id}`, { method: "DELETE" });
export const applySpecGroup = (id: number, productIds: number[]) => api<{ added: number; skipped: number }>(`/dashboard/spec-groups/${id}/apply`, { method: "POST", body: { product_ids: productIds } });
export const pushSpecGroup = (id: number) => api<{ updated: number }>(`/dashboard/spec-groups/${id}/push`, { method: "POST" });
export const saveSpecGrid = (id: number, rows: Array<{ product_id: number; values: Array<{ label: string; value: string | null }> }>) =>
  api<{ updated: number }>(`/dashboard/spec-groups/${id}/grid`, { method: "PUT", body: { rows } });

/** Labels compare without case and outer spaces (back end: ProductSpecs::key). */
export const specKey = (text: string) => text.trim().toLowerCase();
