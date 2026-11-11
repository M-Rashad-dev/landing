"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { BillingPeriod } from "./types";

export type InvoiceStatus = "open" | "pending_review" | "paid" | "cancelled" | "expired" | "refunded";
export type PaymentStatus = "pending_review" | "approved" | "rejected";

export type InvoicePayment = {
  id: number;
  method: { key: string; name: string };
  amount: number;
  sender_ref: string;
  status: PaymentStatus;
  reject_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
};

/** How this invoice can be paid now (from the back end's PaymentGateway). */
export type PayOption = {
  key: string;
  name: string;
  kind: string;
  type: "transfer";
  amount: number;
  account_label: string | null;
  account_value: string | null;
  instructions: string | null;
  reference: string | null;
};

export type Invoice = {
  /** null on the pay page (a draft: the invoice is created with the receipt). */
  id: number | null;
  number: string | null;
  status: InvoiceStatus;
  type: "subscription" | "theme";
  plan: { key: string | null; name: string };
  theme: { key: string; name: string } | null;
  period: BillingPeriod | null;
  days: number | null;
  starts_now: boolean;
  subtotal: number;
  discount: number;
  credit: number;
  total: number;
  currency: string;
  payable: boolean;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  refund_requested_at: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  payments?: InvoicePayment[];
  pay_with?: PayOption[];
};

export type Support = { email: string | null; whatsapp: string | null };

export const invoiceKeys = {
  list: (page: number) => ["billing", "invoices", page] as const,
  one: (id: number) => ["billing", "invoice", id] as const,
};

export function useInvoices(page: number) {
  return useQuery({
    queryKey: invoiceKeys.list(page),
    queryFn: async () => {
      const res = await apiPage<Invoice>("/dashboard/billing/invoices", { query: { page } });
      return { ...res, refundableId: (res.meta as unknown as { refundable_invoice_id: number | null }).refundable_invoice_id };
    },
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: invoiceKeys.one(id),
    queryFn: async () => {
      const res = await apiPage<never>(`/dashboard/billing/invoices/${id}`);
      return { invoice: res.data as unknown as Invoice, support: (res.meta as unknown as { support: Support }).support };
    },
  });
}

/** What is being bought on the pay page. */
export type CheckoutItem = { type: "subscription"; plan_key: string; period: BillingPeriod } | { type: "theme"; theme_key: string };

export function checkoutPath(item: CheckoutItem): string {
  const query: Record<string, string> = item.type === "theme" ? { type: item.type, theme_key: item.theme_key } : { type: item.type, plan_key: item.plan_key, period: item.period };
  return `/dashboard/billing/checkout?${new URLSearchParams(query).toString()}`;
}

/** Reads the pay page item from its URL (null when something is missing). */
export function checkoutItemFrom(search: { get: (key: string) => string | null }): CheckoutItem | null {
  const type = search.get("type");
  if (type === "theme") {
    const key = search.get("theme_key");
    return key ? { type, theme_key: key } : null;
  }
  const plan = search.get("plan_key");
  const period = search.get("period");
  return type === "subscription" && plan && (period === "monthly" || period === "yearly") ? { type, plan_key: plan, period } : null;
}

/** The pay page: what would be paid and how. Nothing is saved until the receipt is sent. */
export function useCheckoutPreview(item: CheckoutItem | null) {
  return useQuery({
    queryKey: ["billing", "checkout", item],
    enabled: item !== null,
    retry: false,
    queryFn: async () => {
      const res = await apiPage<never>("/dashboard/billing/checkout/preview", { method: "POST", body: item });
      return { invoice: res.data as unknown as Invoice, support: (res.meta as unknown as { support: Support }).support };
    },
  });
}

/** Sends the receipt: the invoice is created with it (or the plan starts at once when nothing is due). */
export function placeCheckout(item: CheckoutItem, form?: FormData): Promise<Invoice> {
  if (!form) return api<Invoice>("/dashboard/billing/checkout", { method: "POST", body: item });
  for (const [key, value] of Object.entries(item)) form.set(key, value);
  return api<Invoice>("/dashboard/billing/checkout", { method: "POST", body: form });
}
export const cancelInvoice = (id: number) => api<Invoice>(`/dashboard/billing/invoices/${id}/cancel`, { method: "POST" });
export const payInvoice = (id: number, form: FormData) => api<Invoice>(`/dashboard/billing/invoices/${id}/payments`, { method: "POST", body: form });
export const requestRefund = (reason: string) => api<Invoice>("/dashboard/billing/refund", { method: "POST", body: { reason } });

/** Same-origin URL of a receipt image (the BFF forwards the session; the API checks the store). */
export const receiptUrl = (invoiceId: number, paymentId: number) => `/api/bff/dashboard/billing/invoices/${invoiceId}/payments/${paymentId}/receipt`;
