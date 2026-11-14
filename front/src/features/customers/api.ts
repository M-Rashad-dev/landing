"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderRow, OrderStatus } from "@/features/orders/api";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export const SEGMENTS = ["all", "repeat", "risky", "blocked"] as const;
export type Segment = (typeof SEGMENTS)[number];
export const CUSTOMER_SORTS = ["latest", "orders", "spent", "name"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type CustomerRow = {
  id: number;
  name: string | null;
  phone: string;
  governorate: string | null;
  orders_count: number;
  delivered_count: number;
  open_count: number;
  bad_count: number;
  spent: number;
  last_order_at: string | null;
  blocked: boolean;
};

export type CustomerDetail = CustomerRow & {
  note: string | null;
  block: { reason: string | null; rule: string | null; created_at: string | null } | null;
  block_exempt: boolean;
  city: string | null;
  address: string | null;
  email: string | null;
  first_order_at: string | null;
  counts: Record<OrderStatus, number>;
  average_order: number;
  orders: OrderRow[];
  open_leads: Array<{
    id: number;
    source: "landing" | "store" | "cart";
    cart: {
      items: Array<{ name: string; quantity: number }>;
      total: number;
    } | null;
    quantity: number;
    status: string;
    created_at: string;
  }>;
};

export type CustomerFilters = {
  q: string;
  segment: Segment;
  sort: CustomerSort;
  page: number;
};
type CustomerPage = Paginated<CustomerRow> & {
  meta: Paginated<CustomerRow>["meta"] & { counts: Record<Segment, number> };
};

export function useCustomers(f: CustomerFilters) {
  return useQuery({
    queryKey: ["customers", "list", f],
    queryFn: () =>
      apiPage<CustomerRow>("/dashboard/customers", {
        query: {
          q: f.q,
          segment: f.segment === "all" ? null : f.segment,
          sort: f.sort === "latest" ? null : f.sort,
          page: f.page,
          per_page: 25,
        },
      }) as Promise<CustomerPage>,
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => api<CustomerDetail>(`/dashboard/customers/${id}`),
  });
}

export function useRefreshCustomers() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["customers"] });
}

export const saveCustomerNote = (id: number, note: string | null) =>
  api<CustomerDetail>(`/dashboard/customers/${id}`, {
    method: "PATCH",
    body: { note },
  });
export const blockCustomer = (id: number, blocked: boolean) =>
  api<CustomerDetail>(`/dashboard/customers/${id}/block`, {
    method: "POST",
    body: { blocked },
  });
