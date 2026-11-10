"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { AccessState, BillingPeriod, EntitlementInfo, PlanFeatureKey, PlanLimitKey, PlanQuote, PlanValues, SubscriptionRow, UsageRow } from "@/lib/billing/types";
import type { Domain } from "@/lib/domains/api";
import type { ThemeRow, ThemeTag } from "@/lib/themes/api";

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
  pending_payments: number;
  refund_requests: number;
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


export const adminKeys = {
  overview: ["admin", "overview"] as const,
  tenants: (q: string, status: string, page: number) => ["admin", "tenants", { q, status, page }] as const,
  tenant: (id: number) => ["admin", "tenant", id] as const,
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


export const suspendTenant = (id: number, reason: string) => api<AdminTenantDetail>(`/admin/tenants/${id}/suspend`, { method: "POST", body: { reason } });
export const activateTenant = (id: number) => api<AdminTenantDetail>(`/admin/tenants/${id}/activate`, { method: "POST" });
export const resetTenantPassword = (id: number) => api<{ temporary_password: string }>(`/admin/tenants/${id}/reset-password`, { method: "POST" });
export const setThemeActive = (key: string, isActive: boolean) => api<AdminThemeRow>(`/admin/themes/${key}`, { method: "PATCH", body: { is_active: isActive } });

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

export type BillingSettings = {
  trial_enabled: boolean;
  trial_days: number;
  trial_plan_key: string;
  grace_hours: number;
  invoice_hours: number;
  support_email: string | null;
  support_whatsapp: string | null;
};

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

// --- payments ----------------------------------------------------------------------------

export type AdminPayment = {
  id: number;
  status: "pending_review" | "approved" | "rejected";
  tenant: { id: number; name: string };
  method: { key: string; name: string };
  amount: number;
  sender_ref: string;
  reject_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  invoice: { id: number; number: string | null; status: string; plan_name: string; period: BillingPeriod | null; total: number; starts_now: boolean } | null;
};

export type AdminRefund = {
  id: number;
  number: string | null;
  tenant: { id: number; name: string };
  plan_name: string;
  total: number;
  status: string;
  refund_requested_at: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  refund_ref: string | null;
};

export type AdminPaymentMethod = {
  key: string;
  name: string;
  kind: string;
  account_label: string | null;
  account_value: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

export const paymentKeys = {
  list: (status: string, page: number) => ["admin", "payments", status, page] as const,
  refunds: ["admin", "refunds"] as const,
  methods: ["admin", "payment-methods"] as const,
};

export function useAdminPayments(status: string, page: number) {
  return useQuery({
    queryKey: paymentKeys.list(status, page),
    queryFn: () => apiPage<AdminPayment>("/admin/payments", { query: { status, page } }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminRefunds() {
  return useQuery({ queryKey: paymentKeys.refunds, queryFn: () => api<AdminRefund[]>("/admin/refunds") });
}

export function useAdminPaymentMethods() {
  return useQuery({ queryKey: paymentKeys.methods, queryFn: () => api<AdminPaymentMethod[]>("/admin/payment-methods") });
}

export const approvePayment = (id: number) => api<AdminPayment>(`/admin/payments/${id}/approve`, { method: "POST" });
export const rejectPayment = (id: number, reason: string) => api<AdminPayment>(`/admin/payments/${id}/reject`, { method: "POST", body: { reason } });
export const completeRefund = (invoiceId: number, refundRef: string) => api<AdminRefund[]>(`/admin/invoices/${invoiceId}/refund`, { method: "POST", body: { refund_ref: refundRef } });
export const updatePaymentMethod = (key: string, body: Omit<AdminPaymentMethod, "key" | "kind">) => api<AdminPaymentMethod>(`/admin/payment-methods/${key}`, { method: "PUT", body });
export const adminReceiptUrl = (paymentId: number) => `/api/bff/admin/payments/${paymentId}/receipt`;

// --- theme catalog -----------------------------------------------------------------------

export type AdminThemeRow = ThemeRow & {
  is_active: boolean;
  is_listed: boolean;
  sort_order: number;
  pages_count: number;
  raw: { price: number; discount_percent: number; discount_starts_at: string | null; discount_ends_at: string | null; min_plan_key: string | null; is_featured: boolean; tag_ids: number[] };
};

export type ThemeDetailsPayload = {
  name: string;
  kind: "landing" | "store";
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

export type TenantTheme = { theme_key: string; name: string; source: "purchase" | "admin_grant"; price_paid: number; note: string | null; created_at: string | null };

export const themeCatalogKeys = {
  list: ["admin", "theme-catalog"] as const,
  one: (key: string) => ["admin", "theme-catalog", key] as const,
  tenant: (id: number) => ["admin", "tenant-themes", id] as const,
};

export function useAdminThemeCatalog() {
  return useQuery({
    queryKey: themeCatalogKeys.list,
    queryFn: async () => {
      const res = await apiPage<AdminThemeRow>("/admin/themes");
      return { themes: res.data, tags: (res.meta as unknown as { tags: ThemeTag[] }).tags };
    },
  });
}

export function useAdminTheme(key: string) {
  return useQuery({
    queryKey: themeCatalogKeys.one(key),
    queryFn: async () => {
      const res = await apiPage<never>(`/admin/themes/${encodeURIComponent(key)}`);
      return { theme: res.data as unknown as AdminThemeRow, tags: (res.meta as unknown as { tags: ThemeTag[] }).tags };
    },
  });
}

export function useTenantThemes(id: number) {
  return useQuery({ queryKey: themeCatalogKeys.tenant(id), queryFn: () => api<TenantTheme[]>(`/admin/tenants/${id}/themes`) });
}

export const updateThemeDetails = (key: string, body: ThemeDetailsPayload) => api<AdminThemeRow>(`/admin/themes/${encodeURIComponent(key)}`, { method: "PUT", body });
export const uploadThemeImage = (key: string, form: FormData) => api<AdminThemeRow>(`/admin/themes/${encodeURIComponent(key)}/images`, { method: "POST", body: form });
export const deleteThemeImage = (key: string, id: number) => api<AdminThemeRow>(`/admin/themes/${encodeURIComponent(key)}/images/${id}`, { method: "DELETE" });
export const reorderThemeImages = (key: string, ids: number[]) => api<AdminThemeRow>(`/admin/themes/${encodeURIComponent(key)}/images/order`, { method: "PUT", body: { ids } });
export const createThemeTag = (name: string) => api<ThemeTag>("/admin/theme-tags", { method: "POST", body: { name } });
export const grantTheme = (id: number, themeKey: string, note: string | null) => api<TenantTheme[]>(`/admin/tenants/${id}/themes`, { method: "POST", body: { theme_key: themeKey, note } });
export const revokeTheme = (id: number, themeKey: string) => api<void>(`/admin/tenants/${id}/themes/${encodeURIComponent(themeKey)}`, { method: "DELETE" });
