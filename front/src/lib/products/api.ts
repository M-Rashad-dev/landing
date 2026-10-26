"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { Product } from "@/lib/types";
import type { ProductPayload } from "./form";

export const productKeys = {
  all: ["products"] as const,
  list: (params: Record<string, string | number>) => ["products", "list", params] as const,
  detail: (id: number) => ["products", id] as const,
};

export function useProducts(params: { q?: string; active?: string; page?: number; per_page?: number }) {
  const query = { q: params.q ?? "", active: params.active ?? "", page: params.page ?? 1, per_page: params.per_page ?? 20 };
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: ({ signal }) => apiPage<Product>("/dashboard/products", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function saveProduct(payload: ProductPayload, id?: number): Promise<Product> {
  return id ? api<Product>(`/dashboard/products/${id}`, { method: "PUT", body: payload }) : api<Product>("/dashboard/products", { method: "POST", body: payload });
}

export const toggleProduct = (id: number) => api<Product>(`/dashboard/products/${id}/toggle`, { method: "POST" });
export const duplicateProduct = (id: number) => api<Product>(`/dashboard/products/${id}/duplicate`, { method: "POST" });
export const deleteProduct = (id: number) => api<void>(`/dashboard/products/${id}`, { method: "DELETE" });
