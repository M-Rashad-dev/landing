"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@/components/domain/order-status";
import { api, apiPage, apiRaw } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type { OrderStatus };

/** Tabs: "returned" shows returned and damaged together. */
export const ORDER_TABS = ["all", "new", "confirmed", "shipped", "delivered", "returned", "cancelled", "fake"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const TAB_STATUSES: Record<OrderTab, OrderStatus[]> = {
  all: [],
  new: ["new"],
  confirmed: ["confirmed"],
  shipped: ["shipped"],
  delivered: ["delivered"],
  returned: ["returned", "damaged"],
  cancelled: ["cancelled"],
  fake: ["fake"],
};

export const ORDER_SORTS = ["latest", "oldest", "total_desc", "total_asc"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export type OrderRow = {
  id: number;
  order_number: number;
  status: OrderStatus;
  status_label: string;
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
  unit_price: number;
  quantity: number;
  options: Array<{ option: string; value: string; price_delta?: number }>;
  offer_name: string | null;
  offer_discount: number;
  line_total: number;
};

export type OrderDetail = OrderRow & {
  customer_phone2: string | null;
  customer_email: string | null;
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
