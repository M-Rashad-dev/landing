"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ar } from "@/messages/ar";

/** back end: Dashboard\StorePageController::row */
export type StorePage = {
  id: number;
  title: string;
  slug: string;
  body: string | null;
  is_published: boolean;
  seo: { title?: string; description?: string } | null;
  position: number;
};

export type StorePageInput = { title: string; slug: string | null; body: string | null; is_published: boolean; seo: { title?: string; description?: string } | null };

/** Back end: landing.limits.store_pages. */
export const MAX_PAGES = 50;

export const TEMPLATE_KEYS = ["about", "privacy", "returns", "shipping", "terms", "faq", "contact"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export function template(key: TemplateKey) {
  return ar.storePages.templates[key];
}

export const storePageKeys = { all: ["store-pages"] as const };

export function useStorePages() {
  return useQuery({ queryKey: storePageKeys.all, queryFn: () => api<StorePage[]>("/dashboard/store-pages") });
}

export const saveStorePage = (input: StorePageInput, id?: number) =>
  id ? api<StorePage>(`/dashboard/store-pages/${id}`, { method: "PUT", body: input }) : api<StorePage>("/dashboard/store-pages", { method: "POST", body: input });

export const deleteStorePage = (id: number) => api<void>(`/dashboard/store-pages/${id}`, { method: "DELETE" });

export const reorderStorePages = (ids: number[]) => api<void>("/dashboard/store-pages/order", { method: "PUT", body: { ids } });

/** A page's input as it is (to flip one thing, e.g. published, without touching the rest). */
export const inputOf = (p: StorePage): StorePageInput => ({ title: p.title, slug: p.slug, body: p.body, is_published: p.is_published, seo: p.seo });
