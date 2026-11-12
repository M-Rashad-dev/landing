"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type Period = "monthly" | "yearly";

export type Price = {
  plan_key: string;
  period: Period;
  original: number;
  discount_percent: number;
  final: number;
  discount_ends_at: string | null;
  is_current: boolean;
  change: { credit: number; pay: number; starts_now: boolean };
};
export type Plan = {
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  marketing_points: string[];
  is_highlighted: boolean;
  prices: Partial<Record<Period, Price>>;
  values: Record<string, number | boolean | null>;
};

export type Usage = { key: string; label: string; used: number; limit: number | null; unlimited: boolean; locked: number };

export type PayMethod = {
  key: string;
  name: string;
  kind: string;
  type: string;
  amount: number;
  account_label: string | null;
  account_value: string | null;
  instructions: string | null;
  reference: string | null;
};

export type Payment = {
  id: number;
  method: { key: string; name: string };
  amount: number;
  sender_ref: string | null;
  status: "pending_review" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
};

export type Invoice = {
  id: number | null;
  number: string | null;
  status: "open" | "pending_review" | "paid" | "cancelled" | "expired" | "refunded";
  type: "subscription" | "theme";
  plan: { key: string; name: string };
  theme: { key: string; name: string } | null;
  period: Period | null;
  days: number | null;
  starts_now: boolean;
  subtotal: number;
  discount: number;
  credit: number;
  total: number;
  payable: boolean;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  payments: Payment[];
  pay_with?: PayMethod[];
};

/** What the merchant reads: a bill is under review, accepted, rejected (with the reason) or refunded. */
export type ShownStatus = "pending_review" | "paid" | "rejected" | "refunded" | "expired";
export function shownStatus(invoice: Pick<Invoice, "status" | "payments">): ShownStatus {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "refunded") return "refunded";
  if (invoice.status === "pending_review") return "pending_review";
  const last = invoice.payments[0];
  if (last?.status === "rejected") return "rejected";
  return "expired";
}

export const usePlans = () => useQuery({ queryKey: ["billing", "plans"], queryFn: () => api<Plan[]>("/dashboard/billing/plans") });
export const useUsage = () => useQuery({ queryKey: ["billing", "usage"], queryFn: () => api<Usage[]>("/dashboard/billing/usage") });
export const useInvoices = () => useQuery({ queryKey: ["billing", "invoices"], queryFn: () => apiPage<Invoice>("/dashboard/billing/invoices", { query: { per_page: 50 } }) });
export const useInvoice = (id: number) => useQuery({ queryKey: ["billing", "invoice", id], queryFn: () => api<Invoice>(`/dashboard/billing/invoices/${id}`) });

export function usePreview(plan: string, period: Period) {
  return useQuery({
    queryKey: ["billing", "preview", plan, period],
    queryFn: () => api<Invoice>("/dashboard/billing/checkout/preview", { method: "POST", body: { type: "subscription", plan_key: plan, period } }),
    enabled: plan !== "",
  });
}

/** Multipart POST through the BFF (the receipt image); returns the invoice. */
export async function sendReceipt(path: string, fields: Record<string, string>, receipt: File | null): Promise<Invoice> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  if (receipt) body.append("receipt", receipt);
  try {
    return await api<Invoice>(path, { method: "POST", body });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, {});
  }
}
