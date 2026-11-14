"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

/* ---------- home ---------- */

export type AdminOverview = {
  stores: { total: number; active: number; suspended: number; new_week: number; new_month: number };
  subscriptions: { trials: number; paying: number; gifted: number; expiring_week: number; expired: number; plans: Array<{ key: string; name: string; total: number }> };
  billing: { revenue_month: number; revenue_previous: number; pending_payments: number; refund_requests: number };
  activity: { orders_today: number; orders_month: number; orders_previous: number; sales_month: number; sales_previous: number };
  days: Array<{ date: string; stores: number; orders: number; sales: number }>;
  top_stores: Array<{ id: number; name: string; orders: number; sales: number }>;
};

export const useAdminOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: () => api<AdminOverview>("/admin/overview"), refetchInterval: 60_000, refetchOnWindowFocus: true });

/* ---------- stores ---------- */

export const STORE_TABS = ["all", "trial", "paying", "gifted", "expiring", "expired"] as const;
export type StoreTab = (typeof STORE_TABS)[number];
export const STORE_SORTS = ["newest", "oldest", "sales", "orders"] as const;
export type StoreSort = (typeof STORE_SORTS)[number];
export const STORE_STATUSES = ["all", "active", "suspended"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export type StoreRow = {
  id: number;
  name: string;
  status: "active" | "suspended";
  owner: { id: number; name: string; email: string | null; phone: string | null; last_login_at: string | null } | null;
  subdomain: string | null;
  primary_host: string | null;
  store_url: string | null;
  orders_count: number;
  products_count: number;
  customers_count: number;
  sales: number;
  last_order_at: string | null;
  plan_key: string | null;
  plan_name: string | null;
  plan_state: "active" | "grace" | "expired";
  plan_is_trial: boolean;
  plan_ends_at: string | null;
  created_at: string | null;
};

export type Domain = { id: number; host: string; type: "subdomain" | "custom"; status: string; is_primary: boolean };

export type StoreDetail = StoreRow & { suspended_at: string | null; suspended_reason: string | null; domains: Domain[] };

export type StoreFilters = { q: string; tab: StoreTab; status: StoreStatus; plan: string; sort: StoreSort; page: number };

export function useStores(f: StoreFilters) {
  return useQuery({
    queryKey: ["admin", "stores", f],
    queryFn: () =>
      apiPage<StoreRow>("/admin/tenants", {
        query: {
          q: f.q,
          subscription: f.tab === "all" ? null : f.tab,
          status: f.status === "all" ? null : f.status,
          plan: f.plan || null,
          sort: f.sort === "newest" ? null : f.sort,
          page: f.page,
          per_page: 25,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export const useStore = (id: number) => useQuery({ queryKey: ["admin", "store", id], queryFn: () => api<StoreDetail>(`/admin/tenants/${id}`) });

export function useRefreshStore(id: number) {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ["admin", "store", id] }), client.invalidateQueries({ queryKey: ["admin", "billing", id] }), client.invalidateQueries({ queryKey: ["admin", "activity"] }), client.invalidateQueries({ queryKey: ["admin", "stores"] }), client.invalidateQueries({ queryKey: ["admin", "overview"] })]);
}

export const suspendStore = (id: number, reason: string) => api<StoreDetail>(`/admin/tenants/${id}/suspend`, { method: "POST", body: { reason } });
export const activateStore = (id: number) => api<StoreDetail>(`/admin/tenants/${id}/activate`, { method: "POST" });
export const resetOwnerPassword = (id: number) => api<{ temporary_password: string }>(`/admin/tenants/${id}/reset-password`, { method: "POST" });

/* ---------- a store's plan ---------- */

export type StoreBilling = {
  state: "active" | "grace" | "expired";
  plan: { key: string; name: string } | null;
  period: "monthly" | "yearly" | null;
  is_trial: boolean;
  trial_used: boolean;
  ends_at: string | null;
  grace_ends_at: string | null;
  features: Record<string, boolean>;
  subscriptions: Array<{ id: number; plan_key: string; plan_name: string; period: string | null; source: string; status: string; starts_at: string; ends_at: string; amount_paid: number; note: string | null }>;
  overrides: Array<{ entitlement: string; value: number | null; reason: string; expires_at: string | null }>;
  usage: Array<{ key: string; label: string; used: number; limit: number | null; unlimited: boolean }>;
};

export const useStoreBilling = (id: number) => useQuery({ queryKey: ["admin", "billing", id], queryFn: () => api<StoreBilling>(`/admin/tenants/${id}/billing`) });

export const grantPlan = (id: number, body: { plan_key: string; days: number; note: string | null }) => api<StoreBilling>(`/admin/tenants/${id}/billing/grant`, { method: "POST", body });
export const extendPlan = (id: number, days: number) => api<StoreBilling>(`/admin/tenants/${id}/billing/extend`, { method: "POST", body: { days } });
export const setOverride = (id: number, entitlement: string, body: { value: number | boolean | null; reason: string; expires_at: string | null }) =>
  api<StoreBilling>(`/admin/tenants/${id}/billing/overrides/${entitlement}`, { method: "PUT", body });
export const deleteOverride = (id: number, entitlement: string) => api<void>(`/admin/tenants/${id}/billing/overrides/${entitlement}`, { method: "DELETE" });

export type AdminPlan = { key: string; name: string; is_archived?: boolean };
export const useAdminPlans = () => useQuery({ queryKey: ["admin", "plans"], queryFn: () => api<AdminPlan[]>("/admin/plans"), staleTime: 300_000 });

/* ---------- a store's themes ---------- */

export type StoreTheme = { theme_key: string; name: string; source: string; price_paid: number; note: string | null; created_at: string | null };
export type AdminTheme = { key: string; name: string; kind: string; is_active: boolean; is_free: boolean };

export const useStoreThemes = (id: number) => useQuery({ queryKey: ["admin", "store-themes", id], queryFn: () => api<StoreTheme[]>(`/admin/tenants/${id}/themes`) });
export const useAdminThemes = () => useQuery({ queryKey: ["admin", "themes"], queryFn: () => api<AdminTheme[]>("/admin/themes"), staleTime: 300_000 });
export const grantTheme = (id: number, theme_key: string, note: string | null) => api<StoreTheme[]>(`/admin/tenants/${id}/themes`, { method: "POST", body: { theme_key, note } });
export const revokeTheme = (id: number, key: string) => api<void>(`/admin/tenants/${id}/themes/${key}`, { method: "DELETE" });

/* ---------- history ---------- */

export type AuditRow = {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  tenant: { id: number; name: string } | null;
  meta: Record<string, unknown> | null;
  admin: { id: number; name: string } | null;
  ip: string | null;
  created_at: string | null;
};

export const useActivity = (filters: { tenant?: number; action?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "activity", filters],
    queryFn: () => apiPage<AuditRow>("/admin/audit-logs", { query: { tenant: filters.tenant, action: filters.action || null, page: filters.page ?? 1, per_page: 20 } }) as Promise<Paginated<AuditRow>>,
    placeholderData: keepPreviousData,
  });

/* ---------- email alerts ---------- */

export type AlertEvent = "receipt_submitted" | "refund_requested" | "store_registered" | "daily_summary" | "support_ticket";
export type AlertSettings = { email: string | null; events: AlertEvent[]; available: AlertEvent[]; mail_ready: boolean };

export const useAlertSettings = () => useQuery({ queryKey: ["admin", "alerts"], queryFn: () => api<AlertSettings>("/admin/alerts") });
export const saveAlertSettings = (body: { email: string | null; events: AlertEvent[] }) => api<AlertSettings>("/admin/alerts", { method: "PUT", body });
export const sendTestAlert = () => api<{ sent_to: string; mail_ready: boolean }>("/admin/alerts/test", { method: "POST" });
