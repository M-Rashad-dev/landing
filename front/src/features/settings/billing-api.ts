"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";

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
  /** transfer: send money then upload the receipt; online: pay on the gateway's page (XPay). */
  type: "transfer" | "online" | string;
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
  /** Paid online: there's no receipt image. */
  has_receipt?: boolean;
  created_at: string | null;
  reviewed_at: string | null;
};

export type Invoice = {
  id: number | null;
  number: string | null;
  status: "open" | "pending_review" | "paid" | "cancelled" | "expired" | "refunded";
  type: "subscription" | "theme" | "ai_credit" | "message_pack";
  plan: { key: string; name: string };
  theme: { key: string; name: string; kind: "store" | "landing" | null } | null;
  period: Period | null;
  days: number | null;
  /** A top-up of the AI balance: the amount paid and the free gift of the offer it reached. */
  ai_credit: { amount: number; bonus: number } | null;
  /** WhatsApp messages for cart reminders, added to the store's balance once paid. */
  message_pack?: { messages: number; price: number } | null;
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
  /** An online method was chosen: where to pay now. */
  redirect_url?: string;
  /** Back from the gateway: how the payment ended (paid, waiting = Fawry not paid yet, open / expired / failed). */
  online_status?: "open" | "waiting" | "paid" | "failed" | "expired" | "unknown";
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

/** What is being bought: a plan for a period, a theme (bought once, kept with its updates) or AI balance (EGP). */
export type CheckoutItem = { type: "subscription"; plan_key: string; period: Period } | { type: "theme"; theme_key: string } | { type: "ai_credit"; amount: number } | { type: "message_pack"; messages: number };

export function usePreview(item: CheckoutItem) {
  const key = item.type === "theme" ? item.theme_key : item.type === "ai_credit" ? String(item.amount) : item.type === "message_pack" ? String(item.messages) : `${item.plan_key}:${item.period}`;
  return useQuery({
    queryKey: ["billing", "preview", item.type, key],
    queryFn: () => api<Invoice>("/dashboard/billing/checkout/preview", { method: "POST", body: item }),
    enabled: item.type === "theme" ? item.theme_key !== "" : item.type === "ai_credit" ? item.amount > 0 : item.type === "message_pack" ? item.messages > 0 : item.plan_key !== "",
  });
}

/** The line a bill is for: «باقة … · شهري», «ثيم …» or the AI top-up. */
export function invoiceItem(invoice: Pick<Invoice, "type" | "theme" | "plan" | "period" | "message_pack">, periodLabel: (p: Period) => string): string {
  if (invoice.type === "ai_credit") return ar.settings.checkout.aiCredit;
  if (invoice.type === "message_pack") return ar.settings.checkout.messagePack(invoice.message_pack?.messages ?? 0);
  if (invoice.theme) return ar.common.themeName(invoice.theme.name, invoice.theme.kind);
  return invoice.period ? ar.settings.checkout.plan(invoice.plan.name, periodLabel(invoice.period)) : invoice.plan.name;
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

/** Back from XPay (?session=…): the server asks XPay how the session ended and returns the invoice. */
export const settleOnline = (invoiceId: number, session: string) => api<Invoice>(`/dashboard/billing/invoices/${invoiceId}/online`, { method: "POST", body: { session } });
