"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";

/* ---------- plans ---------- */

export const PERIODS = ["monthly", "yearly"] as const;
export type Period = (typeof PERIODS)[number];

export type PlanPrice = {
  price: number;
  discount_percent: number;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  is_active: boolean;
  now: { original: number; final: number; discount_percent: number; discount_ends_at: string | null } | null;
};

export type AdminPlanRow = {
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  marketing_points: string[] | null;
  is_public: boolean;
  is_highlighted: boolean;
  is_archived: boolean;
  sort_order: number;
  prices: Record<Period, PlanPrice | null>;
  values: Record<string, boolean | number | null>;
  subscribers: number;
};

export type Entitlement = { key: string; kind: "limit" | "feature"; label: string };

export type BillingSettings = {
  trial_enabled: boolean;
  trial_days: number;
  trial_plan_key: string;
  grace_hours: number;
  invoice_hours: number;
  support_email: string | null;
  support_whatsapp: string | null;
};

type PlansResponse = { data: AdminPlanRow[]; meta: { entitlements: Entitlement[]; settings: BillingSettings } };

/** The plans with the catalog of limits / features and the billing settings (one call). */
export function useAdminPlanCatalog() {
  return useQuery({
    queryKey: ["admin", "plans", "full"],
    // The whole envelope: the plans and, in meta, the limits / features catalog and the settings.
    queryFn: () => apiPage<AdminPlanRow>("/admin/plans") as unknown as Promise<PlansResponse>,
  });
}

export type PlanBody = Omit<AdminPlanRow, "subscribers" | "prices"> & {
  prices: Record<Period, { price: number; discount_percent: number; discount_starts_at: string | null; discount_ends_at: string | null; is_active: boolean } | null>;
};

export const createPlan = (body: PlanBody) => api<AdminPlanRow>("/admin/plans", { method: "POST", body });
export const updatePlan = (key: string, body: Omit<PlanBody, "key">) => api<AdminPlanRow>(`/admin/plans/${key}`, { method: "PUT", body });
export const deletePlan = (key: string) => api<void>(`/admin/plans/${key}`, { method: "DELETE" });
export const saveBillingSettings = (body: BillingSettings) => api<BillingSettings>("/admin/billing/settings", { method: "PUT", body });

/* ---------- themes ---------- */

export type ThemeImage = { id: number; kind: "cover" | "desktop" | "mobile"; urls: Record<string, string>; width: number; height: number };
export type ThemeTag = { id: number; slug: string; name: string };

export type AdminThemeRow = {
  key: string;
  name: string;
  kind: "store" | "landing";
  short_description: string | null;
  price: { original: number; final: number; discount_percent: number } | null;
  is_free: boolean;
  is_featured: boolean;
  released_at: string | null;
  cover: Record<string, string> | null;
  tags: ThemeTag[];
  sales: number;
  is_active: boolean;
  is_listed: boolean;
  sort_order: number;
  in_use: number;
  description: string | null;
  features: string[];
  images: ThemeImage[];
  version: string | null;
  raw: { price: number; discount_percent: number; discount_starts_at: string | null; discount_ends_at: string | null; min_plan_key: string | null; is_featured: boolean; tag_ids: number[] };
};

type ThemesResponse<T> = { data: T; meta: { tags: ThemeTag[] } };

/** The whole envelope: the theme(s) and, in meta, every tag. */
const withTags = <T>(path: string) => apiPage<unknown>(path) as unknown as Promise<ThemesResponse<T>>;

export const useAdminThemeList = () => useQuery({ queryKey: ["admin", "themes", "list"], queryFn: () => withTags<AdminThemeRow[]>("/admin/themes") });
export const useAdminTheme = (key: string) => useQuery({ queryKey: ["admin", "themes", "one", key], queryFn: () => withTags<AdminThemeRow>(`/admin/themes/${key}`) });

export const toggleTheme = (key: string, is_active: boolean) => api<AdminThemeRow>(`/admin/themes/${key}`, { method: "PATCH", body: { is_active } });

export type ThemeBody = {
  name: string;
  kind: "store" | "landing";
  short_description: string | null;
  description: string | null;
  features: string[];
  price: number;
  discount_percent: number;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  min_plan_key: string | null;
  is_featured: boolean;
  is_listed: boolean;
  version: string | null;
  released_at: string | null;
  tag_ids: number[];
};

export const saveTheme = (key: string, body: ThemeBody) => api<AdminThemeRow>(`/admin/themes/${key}`, { method: "PUT", body });

export function uploadThemeImage(key: string, file: File, kind: ThemeImage["kind"]) {
  const body = new FormData();
  body.append("image", file);
  body.append("kind", kind);
  return api<AdminThemeRow>(`/admin/themes/${key}/images`, { method: "POST", body });
}

export const deleteThemeImage = (key: string, id: number) => api<AdminThemeRow>(`/admin/themes/${key}/images/${id}`, { method: "DELETE" });
export const reorderThemeImages = (key: string, ids: number[]) => api<AdminThemeRow>(`/admin/themes/${key}/images/order`, { method: "PUT", body: { ids } });
export const createThemeTag = (name: string) => api<ThemeTag>("/admin/theme-tags", { method: "POST", body: { name } });
