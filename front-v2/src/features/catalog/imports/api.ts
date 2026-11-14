"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, apiUpload, type Paginated } from "@/lib/api/client";

export type ImportStatus = "uploaded" | "queued" | "processing" | "completed" | "failed" | "cancelled";
export type ImportMapping = Record<string, number | number[]>;
export type ImportOptions = { match: "sku" | "none"; existing: "update" | "skip"; visible: boolean };

export type ProductImport = {
  id: number;
  status: ImportStatus;
  source: string;
  file_name: string;
  total_rows: number;
  total_products: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  images: { total: number; done: number; failed: number };
  warnings: string[];
  error: string | null;
  options: Partial<ImportOptions>;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  // Only while waiting for the column mapping:
  headers?: string[];
  samples?: string[][];
  mapping?: ImportMapping;
  fields?: string[];
  multi?: string[];
  room?: number | null;
};

export type ImportFailure = { id: number; row_number: number; identifier: string | null; name: string | null; reasons: string[] };

export const IMPORTS_KEY = ["product-imports"] as const;
const ACTIVE: ImportStatus[] = ["queued", "processing"];

export const isActive = (i: Pick<ProductImport, "status">) => ACTIVE.includes(i.status);
/** Images still downloading after the products are in. */
export const imagesPending = (i: Pick<ProductImport, "status" | "images">) => i.status === "completed" && i.images.done + i.images.failed < i.images.total;

export function useImports() {
  return useQuery({ queryKey: IMPORTS_KEY, queryFn: () => api<ProductImport[]>("/dashboard/product-imports") });
}

/** One import; polls every 2 s while the queue works on it (or its images download). */
export function useImport(id: number | null) {
  return useQuery({
    queryKey: [...IMPORTS_KEY, id],
    queryFn: () => api<ProductImport>(`/dashboard/product-imports/${id}`),
    enabled: id !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && (isActive(data) || imagesPending(data)) ? 2000 : false;
    },
  });
}

export function useFailures(id: number | null, page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...IMPORTS_KEY, id, "failures", page],
    queryFn: () => apiPage<ImportFailure>(`/dashboard/product-imports/${id}/failures`, { query: { page, per_page: 50 } }) as Promise<Paginated<ImportFailure>>,
    enabled: id !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useRefreshImports() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: IMPORTS_KEY });
}

export function uploadImport(file: File, onProgress: (p: number) => void) {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<ProductImport>("/dashboard/product-imports", form, onProgress);
}

export const startImport = (id: number, mapping: ImportMapping, options: ImportOptions) => api<ProductImport>(`/dashboard/product-imports/${id}/start`, { method: "POST", body: { mapping, options } });
export const cancelImport = (id: number) => api<ProductImport>(`/dashboard/product-imports/${id}/cancel`, { method: "POST" });
export const deleteImport = (id: number) => api<void>(`/dashboard/product-imports/${id}`, { method: "DELETE" });

/** Files come straight from the BFF (the session cookie signs the request). */
export const TEMPLATE_URL = "/api/bff/dashboard/product-imports/template";
export const failuresFileUrl = (id: number) => `/api/bff/dashboard/product-imports/${id}/failures/file`;

/** Field groups on the mapping screen. */
export const FIELD_GROUPS: Array<{ key: "main" | "details" | "variants"; fields: string[] }> = [
  { key: "main", fields: ["name", "price", "sale_price", "compare_at_price", "sku", "stock"] },
  { key: "details", fields: ["description", "short_description", "category", "images", "status", "slug", "seo_title", "seo_description"] },
  { key: "variants", fields: ["group", "option1_name", "option1_value", "option2_name", "option2_value", "option3_name", "option3_value", "variant_image", "external_id", "parent"] },
];
