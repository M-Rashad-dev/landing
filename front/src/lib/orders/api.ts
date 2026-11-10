"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage, apiRaw } from "@/lib/api/client";

export const ORDER_STATUSES = ["new", "confirmed", "delivered", "returned", "damaged", "fake", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ContactResult = "no_answer" | "postponed" | "whatsapp";

export type OrderRow = {
  id: number;
  order_number: number;
  status: OrderStatus;
  status_label: string;
  customer_name: string;
  customer_phone: string;
  governorate: string | null;
  product: { id: number; name: string } | null;
  page: { id: number; title: string; slug: string } | null;
  quantity: number;
  /** "store" = a cart order with several lines (product is null); "landing" = a page order. */
  source?: "landing" | "store";
  items_summary?: { first: string | null; count: number };
  total: number;
  currency: string;
  is_duplicate_suspect: boolean;
  created_at: string;
  status_changed_at: string | null;
  contact_attempts: number;
  last_contacted_at: string | null;
  follow_up_at: string | null;
};

export type OrderDetail = OrderRow & {
  customer_phone2: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  internal_note: string | null;
  answers: Array<{ key: string; label: string; type: string; value: string | number | boolean }>;
  unit_price: number;
  subtotal: number;
  offer: { id: number | null; name: string; discount: number } | null;
  code: { id: number | null; code: string; discount: number } | null;
  shipping_fee: number;
  items: Array<{ id: number; product_id: number | null; product_name: string; is_upsell?: boolean; is_gift?: boolean; unit_price: number; quantity: number; options: Array<{ option: string; value: string; price_delta: number }>; line_total: number; offer_name?: string | null; offer_discount?: number }>;
  logs: Array<{ id: number; from_status: OrderStatus | null; to_status: OrderStatus; to_label: string; note: string | null; user: { id: number; name: string } | null; created_at: string }>;
  events: Array<{ id: number; type: ContactResult; label: string; note: string | null; follow_up_at: string | null; user: { id: number; name: string } | null; created_at: string }>;
  allowed_transitions: Array<{ status: OrderStatus; label: string }>;
  can_edit_customer: boolean;
  ip_address: string | null;
  user_agent: string | null;
  utm: Record<string, string> | null;
  brand: { name: string; logo: string | null; phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  customer_history: {
    total: number;
    counts: Record<OrderStatus, number>;
    bad_ratio: number;
    phone_blocked: boolean;
    ip_blocked: boolean;
    orders: Array<{ id: number; order_number: number; status: OrderStatus; status_label: string; total: number; created_at: string }>;
  };
};

export type OrderStats = { counts: Record<OrderStatus, number>; all: number; new_since: number | null; latest_id: number | null; server_time: string };

export type OrderFilters = { status: string; q: string; page_id: string; product_id: string; from: string; to: string; duplicate: boolean; sort: string; page: number };

export const EMPTY_FILTERS: OrderFilters = { status: "", q: "", page_id: "", product_id: "", from: "", to: "", duplicate: false, sort: "latest", page: 1 };

export type BlockedCustomer = { id: number; type: "phone" | "ip"; value: string; reason: string | null; created_at: string | null };

export type Overview = {
  orders_today: number;
  orders_week: number;
  orders_month: number;
  counts: Record<OrderStatus, number>;
  total_orders: number;
  revenue_delivered: number;
  chart: Array<{ date: string; count: number }>;
  top_pages: Array<{ id: number; title: string | null; slug: string | null; orders: number }>;
  latest_orders: OrderRow[];
  pages_count: number;
  published_pages: number;
};

export const orderKeys = {
  all: ["orders"] as const,
  list: (f: object) => ["orders", "list", f] as const,
  stats: (f: object) => ["orders", "stats", f] as const,
  detail: (id: number) => ["orders", id] as const,
  blocked: (p: object) => ["blocked-customers", p] as const,
  overview: ["overview"] as const,
  queue: ["orders", "confirmation-queue"] as const,
};

/** Query string of the list filters (shared by the list, the counters and the export). */
export function filterQuery(filters: OrderFilters, { withStatus = true, withPage = true } = {}) {
  return {
    status: withStatus ? filters.status : "",
    q: filters.q.trim(),
    page_id: filters.page_id,
    product_id: filters.product_id,
    from: filters.from,
    to: filters.to,
    duplicate: filters.duplicate ? 1 : "",
    sort: filters.sort === "latest" ? "" : filters.sort,
    page: withPage && filters.page > 1 ? filters.page : "",
  };
}

export function useOrders(filters: OrderFilters) {
  const query = filterQuery(filters);
  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: ({ signal }) => apiPage<OrderRow>("/dashboard/orders", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Counters per status for the tabs (same filters, any status). */
export function useOrderCounts(filters: OrderFilters) {
  const query = filterQuery(filters, { withStatus: false, withPage: false });
  return useQuery({
    queryKey: orderKeys.stats(query),
    queryFn: ({ signal }) => api<OrderStats>("/dashboard/orders/stats", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Order details for printing (bulk invoices). */
export const fetchOrder = (id: number, signal?: AbortSignal) => api<OrderDetail>(`/dashboard/orders/${id}`, { signal });

export function useOrder(id: number) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: ({ signal }) => api<OrderDetail>(`/dashboard/orders/${id}`, { signal }) });
}

export function useBlockedCustomers(params: { type: string; page: number }) {
  return useQuery({
    queryKey: orderKeys.blocked(params),
    queryFn: ({ signal }) => apiPage<BlockedCustomer>("/dashboard/blocked-customers", { query: params, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useOverview() {
  return useQuery({ queryKey: orderKeys.overview, queryFn: ({ signal }) => api<Overview>("/dashboard/overview", { signal }) });
}

export const fetchOrderStats = (since: string | null) => api<OrderStats>("/dashboard/orders/stats", { query: { since } });

export const changeOrderStatus = (id: number, body: { status: OrderStatus; note?: string | null; block_phone?: boolean; block_ip?: boolean }) =>
  api<OrderDetail>(`/dashboard/orders/${id}/status`, { method: "POST", body });

export const bulkOrderStatus = (ids: number[], status: OrderStatus, note?: string | null) =>
  api<{ results: Array<{ id: number; order_number?: number; ok: boolean; error: string | null }>; succeeded: number; failed: number }>("/dashboard/orders/bulk-status", {
    method: "POST",
    body: { ids, status, note },
  });

export type OrderUpdate = Partial<Pick<OrderDetail, "customer_name" | "customer_phone" | "customer_phone2" | "governorate" | "city" | "address" | "notes" | "internal_note">>;
export const updateOrder = (id: number, body: OrderUpdate) => api<OrderDetail>(`/dashboard/orders/${id}`, { method: "PATCH", body });

export const addBlocked = (body: { type: "phone" | "ip"; value: string; reason?: string | null }) => api<BlockedCustomer>("/dashboard/blocked-customers", { method: "POST", body });
export const removeBlocked = (id: number) => api<void>(`/dashboard/blocked-customers/${id}`, { method: "DELETE" });

/** Downloads the CSV through the BFF (keeps the cookie on the server side). */
export async function downloadOrdersCsv(filters: OrderFilters): Promise<void> {
  const response = await apiRaw("/dashboard/orders/export", { query: filterQuery(filters, { withPage: false }) });
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "orders.csv";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** wa.me link for an E.164 number (+20…). */

export type ConfirmationQueue = { orders: OrderRow[]; due: number; later: number };

/** New orders in calling order (due first), refreshed every 30 s. */
export function useConfirmationQueue() {
  return useQuery({
    queryKey: orderKeys.queue,
    queryFn: async ({ signal }) => {
      const page = await apiPage<OrderRow>("/dashboard/orders/confirmation-queue", { signal });
      return { orders: page.data, due: Number(page.meta.due ?? 0), later: Number(page.meta.later ?? 0) } satisfies ConfirmationQueue;
    },
    refetchInterval: 30_000,
  });
}

/** Log a contact attempt; follow_up_at is Cairo wall time "YYYY-MM-DDTHH:mm". */
export function recordContact(id: number, result: ContactResult, extra: { note?: string; follow_up_at?: string } = {}) {
  return api<OrderDetail>(`/dashboard/orders/${id}/contact`, { method: "POST", body: { result, ...extra } });
}

/** What a list shows for the ordered product(s): the page product, or "first item + N more" for store carts. */
export function orderProductLabel(order: Pick<OrderRow, "product" | "source" | "items_summary">, more: (n: number) => string): string {
  if (order.source === "store" && order.items_summary) {
    const { first, count } = order.items_summary;
    if (!first) return "—";
    return count > 1 ? `${first} ${more(count - 1)}` : first;
  }
  return order.product?.name ?? "—";
}
