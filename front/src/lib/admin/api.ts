"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { Domain } from "@/lib/domains/api";

export type AdminOverview = {
  tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  new_tenants_week: number;
  published_pages: number;
  orders_today: number;
  orders_total: number;
};

export type AdminTenant = {
  id: number;
  name: string;
  status: "active" | "suspended";
  owner: { id: number; name: string; email: string; phone: string; last_login_at: string | null } | null;
  subdomain: string | null;
  primary_host: string | null;
  pages_count: number;
  published_pages_count: number;
  orders_count: number;
  created_at: string | null;
};

export type AdminTenantDetail = AdminTenant & { suspended_at: string | null; suspended_reason: string | null; domains: Domain[] };

export type AdminTheme = { key: string; name: string; is_active: boolean; sort_order: number; pages_count: number };

export const adminKeys = {
  overview: ["admin", "overview"] as const,
  tenants: (q: string, status: string, page: number) => ["admin", "tenants", { q, status, page }] as const,
  tenant: (id: number) => ["admin", "tenant", id] as const,
  themes: ["admin", "themes"] as const,
};

export function useAdminOverview() {
  return useQuery({ queryKey: adminKeys.overview, queryFn: () => api<AdminOverview>("/admin/overview") });
}

export function useAdminTenants(q: string, status: string, page: number) {
  return useQuery({
    queryKey: adminKeys.tenants(q, status, page),
    queryFn: () => apiPage<AdminTenant>("/admin/tenants", { query: { q: q || undefined, status: status || undefined, page } }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTenant(id: number) {
  return useQuery({ queryKey: adminKeys.tenant(id), queryFn: () => api<AdminTenantDetail>(`/admin/tenants/${id}`) });
}

export function useAdminThemes() {
  return useQuery({ queryKey: adminKeys.themes, queryFn: () => api<AdminTheme[]>("/admin/themes") });
}

export const suspendTenant = (id: number, reason: string) => api<AdminTenantDetail>(`/admin/tenants/${id}/suspend`, { method: "POST", body: { reason } });
export const activateTenant = (id: number) => api<AdminTenantDetail>(`/admin/tenants/${id}/activate`, { method: "POST" });
export const resetTenantPassword = (id: number) => api<{ temporary_password: string }>(`/admin/tenants/${id}/reset-password`, { method: "POST" });
export const setThemeActive = (key: string, isActive: boolean) => api<AdminTheme>(`/admin/themes/${key}`, { method: "PATCH", body: { is_active: isActive } });
