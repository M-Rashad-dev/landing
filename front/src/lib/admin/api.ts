"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { AccessState, BillingPeriod, EntitlementInfo, PlanFeatureKey, PlanLimitKey, PlanQuote, PlanValues, SubscriptionRow, UsageRow } from "@/lib/billing/types";
import type { Domain } from "@/lib/domains/api";

export type AdminOverview = {
  tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  new_tenants_week: number;
  published_pages: number;
  orders_today: number;
  orders_total: number;
  plans: { key: string; name: string; total: number }[];
  trials: number;
  expiring_week: number;
  expired: number;
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
  plan_key: string | null;
  plan_state: AccessState;
  plan_is_trial: boolean;
  plan_ends_at: string | null;
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

// --- plans -------------------------------------------------------------------------------

export type AdminPlanPrice = {
  price: number;
  discount_percent: number;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  is_active: boolean;
  now: PlanQuote | null;
};

export type AdminPlan = {
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  marketing_points: string[];
  is_public: boolean;
  is_highlighted: boolean;
  is_archived: boolean;
  sort_order: number;
  prices: Record<BillingPeriod, AdminPlanPrice | null>;
  values: PlanValues;
  subscribers: number;
};

export type BillingSettings = { trial_enabled: boolean; trial_days: number; trial_plan_key: string; grace_hours: number };

export type AdminPlansData = { plans: AdminPlan[]; entitlements: EntitlementInfo[]; settings: BillingSettings };

export type PlanPricePayload = Omit<AdminPlanPrice, "now"> | null;

export type PlanPayload = {
  key?: string;
  name: string;
  tagline: string | null;
  description: string | null;
  marketing_points: string[];
  is_public: boolean;
  is_highlighted: boolean;
  is_archived: boolean;
  sort_order: number;
  prices: Record<BillingPeriod, PlanPricePayload>;
  values: PlanValues;
};

export type TenantBilling = {
  state: AccessState;
  plan: { key: string; name: string } | null;
  period: BillingPeriod | null;
  is_trial: boolean;
  trial_used: boolean;
  ends_at: string | null;
  grace_ends_at: string | null;
  features: Record<PlanFeatureKey, boolean>;
  subscriptions: (Omit<SubscriptionRow, "plan" | "is_trial"> & { plan_key: string; plan_name: string; note: string | null })[];
  overrides: { entitlement: PlanLimitKey | PlanFeatureKey; value: number | null; reason: string; expires_at: string | null }[];
  usage: Omit<UsageRow, "locked">[];
};

export const planKeys = {
  all: ["admin", "plans"] as const,
  tenantBilling: (id: number) => ["admin", "tenant-billing", id] as const,
};

export function useAdminPlans() {
  return useQuery({
    queryKey: planKeys.all,
    queryFn: async () => {
      const res = await apiPage<AdminPlan>("/admin/plans");
      const meta = res.meta as unknown as { entitlements: EntitlementInfo[]; settings: BillingSettings };
      return { plans: res.data, entitlements: meta.entitlements, settings: meta.settings } satisfies AdminPlansData;
    },
  });
}

export const createPlan = (payload: PlanPayload) => api<AdminPlan>("/admin/plans", { method: "POST", body: payload });
export const updatePlan = (key: string, payload: PlanPayload) => api<AdminPlan>(`/admin/plans/${key}`, { method: "PUT", body: payload });
export const deletePlan = (key: string) => api<void>(`/admin/plans/${key}`, { method: "DELETE" });
export const saveBillingSettings = (settings: BillingSettings) => api<BillingSettings>("/admin/billing/settings", { method: "PUT", body: settings });

export function useTenantBilling(id: number) {
  return useQuery({ queryKey: planKeys.tenantBilling(id), queryFn: () => api<TenantBilling>(`/admin/tenants/${id}/billing`) });
}

export const grantPlan = (id: number, body: { plan_key: string; days: number; note: string | null }) => api<TenantBilling>(`/admin/tenants/${id}/billing/grant`, { method: "POST", body });
export const extendPlan = (id: number, days: number) => api<TenantBilling>(`/admin/tenants/${id}/billing/extend`, { method: "POST", body: { days } });
export const setOverride = (id: number, entitlement: string, body: { value: number | boolean | null; reason: string; expires_at: string | null }) =>
  api<TenantBilling>(`/admin/tenants/${id}/billing/overrides/${entitlement}`, { method: "PUT", body });
export const deleteOverride = (id: number, entitlement: string) => api<void>(`/admin/tenants/${id}/billing/overrides/${entitlement}`, { method: "DELETE" });
