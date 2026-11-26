"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shipment, ShipmentState } from "@/features/shipping/carriers-api";
import type { OrderStatus } from "@/components/domain/order-status";
import { api, apiPage, apiRaw, type Paginated } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type { OrderStatus };

/** Tabs: "returned" shows returned and damaged together. */
export const ORDER_TABS = ["all", "awaiting_payment", "new", "confirmed", "shipped", "delivered", "returned", "cancelled", "fake"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const TAB_STATUSES: Record<OrderTab, OrderStatus[]> = {
  all: [],
  awaiting_payment: ["awaiting_payment"],
  new: ["new"],
  confirmed: ["confirmed"],
  shipped: ["shipped"],
  delivered: ["delivered"],
  returned: ["returned", "damaged"],
  cancelled: ["cancelled"],
  fake: ["fake"],
};

export type ConfirmState = "sent" | "reminded" | "confirmed" | "cancelled" | "needs_call" | "no_reply" | "failed";

export const ORDER_SORTS = ["latest", "oldest", "total_desc", "total_asc"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export type OrderRow = {
  id: number;
  order_number: number;
  status: OrderStatus;
  status_label: string;
  /** cod | prepaid; payment_status null for cash on delivery. */
  payment_method?: "cod" | "prepaid";
  payment_status?: "unpaid" | "review" | "paid" | null;
  /** Money sent back (refunds): null | partial | full. */
  refund_state?: "partial" | "full" | null;
  refunded_total?: number;
  /** WhatsApp confirmation: sent / reminded (waiting) / confirmed / cancelled / needs_call / no_reply / failed. */
  confirm_state?: ConfirmState | null;
  confirm_state_label?: string | null;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  governorate: string | null;
  product: { id: number; name: string } | null;
  page: { id: number; title: string; slug: string } | null;
  quantity: number;
  source: "store" | "landing";
  shipping_company: string | null;
  tracking_number: string | null;
  shipment?: { id: number; state: ShipmentState; state_label: string; is_open: boolean; tracking_number: string } | null;
  items_summary?: { first: string | null; count: number };
  total: number;
  is_duplicate_suspect: boolean;
  created_at: string;
  status_changed_at: string | null;
  contact_attempts: number;
  last_contacted_at: string | null;
  follow_up_at: string | null;
};

export type OrderItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  is_upsell: boolean;
  is_gift: boolean;
  /** A digital line: how it is delivered. */
  delivery_type?: "files" | "codes" | "links" | "services" | null;
  unit_price: number;
  quantity: number;
  /** Option values, then «حسب الطلب» fields (kind set; uploads carry upload_id). */
  options: Array<{ option: string; value: string; price_delta?: number; kind?: "text" | "textarea" | "image" | "file"; upload_id?: number }>;
  offer_name: string | null;
  offer_discount: number;
  line_total: number;
};

export type CustomerMessage = { id: number; purpose: keyof typeof import("@/messages/ar/orders").orders.detail.messages.purpose; channel: "whatsapp" | "email"; via?: "platform" | "smtp" | null; status: "pending" | "sent" | "delivered" | "read" | "failed"; error: string | null; created_at: string };

/** A prepaid order's payment (back: OrderDetailResource «payment»). */
export type OrderPaymentInfo = {
  method_name: string | null;
  status: "unpaid" | "review" | "paid" | null;
  paid_at: string | null;
  pay_url: string | null;
  receipts: Array<{ id: number; method_name: string; amount: number; sender_ref: string | null; status: "pending" | "approved" | "rejected"; reject_reason: string | null; is_pdf: boolean; reviewer: string | null; reviewed_at: string | null; created_at: string }>;
};

/** A digital line's delivery (back: OrderDetailResource «deliveries»). */
export type OrderDelivery = {
  id: number;
  order_item_id: number;
  type: "files" | "codes" | "links" | "services";
  /** revoked: refunded with «وقف التحميل». */
  status: "pending" | "delivered" | "revoked";
  codes: string[];
  link: string | null;
  subject: string | null;
  message: string | null;
  limit: number | null;
  bonus: number;
  usage: Record<string, number>;
  files: Array<{ id: number; name: string }>;
  default_subject: string | null;
  default_message: string | null;
  delivered_at: string | null;
  emailed_at: string | null;
};

export type RefundMethod = "original" | "wallet" | "instapay" | "bank" | "cash" | "gateway";
/** By hand; "gateway" (back through the store's gateway) only shows for orders paid online. */
export const REFUND_METHODS: RefundMethod[] = ["original", "wallet", "instapay", "bank", "cash"];

/** One refund (back: App\Orders\Refunds::view). */
export type Refund = {
  id: number;
  order_id: number;
  order_number: number;
  customer_name: string;
  amount: number;
  items: Array<{ order_item_id: number; product_name: string | null; quantity: number }>;
  reason: string | null;
  method: RefundMethod;
  method_label: string;
  destination: string | null;
  reference: string | null;
  has_proof: boolean;
  proof_is_pdf: boolean;
  status: "pending" | "done" | "cancelled";
  restock: boolean;
  restocked: boolean;
  revoke_digital: boolean;
  created_by: string | null;
  done_by: string | null;
  done_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

/** The order page's refunds box (back: Refunds::orderView). */
export type OrderRefunds = {
  collected: number;
  refundable: number;
  refunded: number;
  state: "partial" | "full" | null;
  method_name: string;
  /** Paid online with the store's gateway: the money can go back through it by itself. */
  gateway?: { key: string; label: string } | null;
  default_destination: string | null;
  items_left: Record<string, number>;
  list: Refund[];
};

export type OrderDetail = Omit<OrderRow, "shipment"> & {
  shipment: Shipment | null;
  payment: OrderPaymentInfo | null;
  refunds: OrderRefunds;
  deliveries?: OrderDelivery[];
  customer_phone2: string | null;
  customer_email: string | null;
  /** Where order updates go (WhatsApp on the phone; email when WhatsApp isn't set up). */
  notify_via: "whatsapp" | "email" | null;
  customer_messages: CustomerMessage[];
  city: string | null;
  address: string | null;
  notes: string | null;
  internal_note: string | null;
  answers: Array<{ label: string; value: string }> | Record<string, string>;
  unit_price: number | null;
  subtotal: number;
  offer: { id: number | null; name: string; discount: number } | null;
  code: { id: number | null; code: string; discount: number } | null;
  shipping_fee: number;
  /** Only for whoever sees «الأرباح» (costs as they were when the order was placed). */
  profit?: { revenue: number; refunds?: number; product_cost: number; shipping_cost: number; cod_fee: number; packaging: number; profit: number; loss: boolean; cost_known: boolean };
  shipping: {
    company: { id: number | null; name: string } | null;
    offer: string | null;
    discount: number;
    tracking_number: string | null;
  };
  items: OrderItem[];
  logs: Array<{
    id: number;
    from_status: OrderStatus | null;
    to_status: OrderStatus;
    to_label: string;
    note: string | null;
    user: { id: number; name: string } | null;
    created_at: string;
  }>;
  events: Array<{
    id: number;
    type: string;
    label: string;
    note: string | null;
    follow_up_at: string | null;
    user: { id: number; name: string } | null;
    created_at: string;
  }>;
  allowed_transitions: Array<{ status: OrderStatus; label: string }>;
  can_edit_customer: boolean;
  ip_address: string | null;
  customer_history: {
    total: number;
    counts: Record<OrderStatus, number>;
    bad_ratio: number;
    phone_blocked: boolean;
    ip_blocked: boolean;
    orders: Array<{
      id: number;
      order_number: number;
      status: OrderStatus;
      status_label: string;
      total: number;
      created_at: string;
    }>;
  };
  brand: {
    name: string;
    logo: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
  };
};

export type OrderFilters = {
  tab: OrderTab;
  q: string;
  from: string;
  to: string;
  governorate: string;
  source: string;
  company: string;
  duplicate: boolean;
  sort: OrderSort;
  page: number;
};

export function orderQuery(f: OrderFilters, withStatus = true) {
  return {
    status: withStatus && f.tab !== "all" ? TAB_STATUSES[f.tab].join(",") : null,
    q: f.q,
    from: f.from,
    to: f.to,
    governorate: f.governorate,
    source: f.source,
    shipping_company_id: f.company,
    duplicate: f.duplicate ? 1 : null,
    sort: f.sort === "latest" ? null : f.sort,
  };
}

export const orderKeys = {
  all: ["orders"] as const,
  list: (f: OrderFilters) => ["orders", "list", f] as const,
  stats: (f: OrderFilters) => ["orders", "stats", { ...f, tab: "all", page: 1 }] as const,
  detail: (id: number) => ["orders", "detail", id] as const,
};

export function useOrders(f: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(f),
    queryFn: () =>
      apiPage<OrderRow>("/dashboard/orders", {
        query: { ...orderQuery(f), page: f.page, per_page: 25 },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useOrderStats(f: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.stats(f),
    queryFn: () => api<{ counts: Record<OrderStatus, number>; all: number }>("/dashboard/orders/stats", { query: orderQuery(f, false) }),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api<OrderDetail>(`/dashboard/orders/${id}`),
  });
}

export function useRefreshOrders() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: orderKeys.all }), client.invalidateQueries({ queryKey: ["customers"] })]);
}

export type StatusChange = {
  status: OrderStatus;
  note?: string;
  tracking_number?: string;
  block_phone?: boolean;
  block_ip?: boolean;
};

export const changeStatus = (id: number, body: StatusChange) => api<OrderDetail>(`/dashboard/orders/${id}/status`, { method: "POST", body });
export const updateOrder = (id: number, body: Record<string, string | null>) => api<OrderDetail>(`/dashboard/orders/${id}`, { method: "PATCH", body });
export const recordContact = (
  id: number,
  body: {
    result: "no_answer" | "postponed" | "whatsapp";
    note?: string;
    follow_up_at?: string;
  },
) => api<OrderDetail>(`/dashboard/orders/${id}/contact`, { method: "POST", body });
export const bulkStatus = (ids: number[], status: OrderStatus, note?: string) =>
  api<{
    succeeded: number;
    failed: number;
    results: Array<{ id: number; ok: boolean; error: string | null }>;
  }>("/dashboard/orders/bulk-status", {
    method: "POST",
    body: { ids, status, note },
  });

/** Downloads the CSV of the current filters (same rules as the list). */
export async function exportOrders(f: OrderFilters): Promise<void> {
  const response = await apiRaw("/dashboard/orders/export", {
    query: orderQuery(f),
  });
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
  const blob = await response.blob();
  const name = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "orders.csv";
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: name,
  });
  a.click();
  URL.revokeObjectURL(url);
}

/** Where every status can go next (back: OrderStatus::allowedTransitions), for bulk changes. */
export const NEXT: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["confirmed", "cancelled", "fake"],
  new: ["confirmed", "cancelled", "fake"],
  confirmed: ["shipped", "delivered", "cancelled", "damaged", "fake"],
  shipped: ["delivered", "returned", "damaged", "cancelled"],
  delivered: ["returned", "damaged"],
  returned: [],
  damaged: [],
  cancelled: ["new"],
  fake: ["new"],
};

/** wa.me link for an Egyptian E.164 phone with a prefilled message. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export type RefundInput = {
  amount: string;
  method: RefundMethod;
  items?: Array<{ order_item_id: number; quantity: number }>;
  reason?: string;
  destination?: string;
  restock?: boolean;
  revoke_digital?: boolean;
  done?: boolean;
  reference?: string;
  proof?: File | null;
};

/** «رد مبلغ»: JSON, or multipart when a proof is attached. */
export function createRefund(orderId: number, input: RefundInput) {
  const { proof, ...rest } = input;
  if (!proof) return api<Refund>(`/dashboard/orders/${orderId}/refunds`, { method: "POST", body: rest });
  return api<Refund>(`/dashboard/orders/${orderId}/refunds`, { method: "POST", body: refundForm(rest, proof) });
}

export function completeRefund(id: number, reference: string, proof: File | null) {
  return api<Refund>(`/dashboard/refunds/${id}/complete`, { method: "POST", body: refundForm({ reference }, proof) });
}

export const cancelRefund = (id: number) => api<Refund>(`/dashboard/refunds/${id}/cancel`, { method: "POST" });

export const refundProofUrl = (id: number) => `/api/bff/dashboard/refunds/${id}/proof`;

export type RefundTab = "pending" | "done" | "cancelled" | "all";

export function useRefunds(status: RefundTab, page: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["orders", "refunds", status, page] as const,
    queryFn: () => apiPage<Refund>("/dashboard/refunds", { query: { status, page, per_page: 25 } }) as Promise<Paginated<Refund> & { meta: Paginated<Refund>["meta"] & { pending_count: number; pending_total: number } }>,
    placeholderData: keepPreviousData,
  });
}

function refundForm(values: Record<string, unknown>, proof: File | null): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "items" && Array.isArray(value)) {
      value.forEach((line: { order_item_id: number; quantity: number }, i) => {
        form.append(`items[${i}][order_item_id]`, String(line.order_item_id));
        form.append(`items[${i}][quantity]`, String(line.quantity));
      });
    } else if (typeof value === "boolean") {
      form.append(key, value ? "1" : "0");
    } else {
      form.append(key, String(value));
    }
  }
  if (proof) form.append("proof", proof);
  return form;
}
