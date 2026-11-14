"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export const PAYMENT_TABS = ["pending_review", "approved", "rejected", "all"] as const;
export type PaymentTab = (typeof PAYMENT_TABS)[number];

export type PaymentRow = {
  id: number;
  status: "pending_review" | "approved" | "rejected";
  tenant: { id: number; name: string; reference: string };
  method: { key: string; name: string };
  amount: number;
  sender_ref: string;
  reject_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  repeated_ref: boolean;
  invoice: { id: number; number: string; status: string; type: string; plan_name: string; period: "monthly" | "yearly" | null; total: number; starts_now: boolean } | null;
};

export type PaymentFilters = { tab: PaymentTab; q: string; method: string; from: string; to: string; page: number };
type PaymentPage = Paginated<PaymentRow> & { meta: Paginated<PaymentRow>["meta"] & { pending: number; counts: Record<PaymentTab, number> } };

export function usePayments(f: PaymentFilters) {
  return useQuery({
    queryKey: ["admin", "payments", f],
    queryFn: () =>
      apiPage<PaymentRow>("/admin/payments", {
        query: { status: f.tab, q: f.q, method: f.method || null, from: f.from || null, to: f.to || null, page: f.page, per_page: 25 },
      }) as Promise<PaymentPage>,
    placeholderData: keepPreviousData,
  });
}

/** Every list that shows money waiting (payments, the home, the bell, a store's plan). */
export function useRefreshMoney() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ["admin", "payments"] }), client.invalidateQueries({ queryKey: ["admin", "refunds"] }), client.invalidateQueries({ queryKey: ["admin", "overview"] }), client.invalidateQueries({ queryKey: ["admin", "billing"] })]);
}

export const receiptUrl = (id: number) => `/api/bff/admin/payments/${id}/receipt`;
export const approvePayment = (id: number) => api<PaymentRow>(`/admin/payments/${id}/approve`, { method: "POST" });
export const rejectPayment = (id: number, reason: string) => api<PaymentRow>(`/admin/payments/${id}/reject`, { method: "POST", body: { reason } });

/* ---------- refunds ---------- */

export type RefundRow = {
  id: number;
  number: string;
  tenant: { id: number; name: string };
  plan_name: string;
  total: number;
  status: "paid" | "refunded";
  refund_requested_at: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  refund_ref: string | null;
};

export const useRefunds = () => useQuery({ queryKey: ["admin", "refunds"], queryFn: () => api<RefundRow[]>("/admin/refunds") });
export const completeRefund = (invoiceId: number, refund_ref: string) => api<RefundRow[]>(`/admin/invoices/${invoiceId}/refund`, { method: "POST", body: { refund_ref } });

/* ---------- payment methods ---------- */

export type PaymentMethod = {
  key: string;
  name: string;
  kind: string;
  account_label: string | null;
  account_value: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

export const usePaymentMethods = () => useQuery({ queryKey: ["admin", "payment-methods"], queryFn: () => api<PaymentMethod[]>("/admin/payment-methods") });
export const savePaymentMethod = (key: string, body: Omit<PaymentMethod, "key" | "kind">) => api<PaymentMethod>(`/admin/payment-methods/${key}`, { method: "PUT", body });
