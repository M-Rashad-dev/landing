"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, type ApiErrorBody } from "@/lib/api/errors";
import type { TrackStage } from "./types";

/* ---------- Types (back end: StoreAccountController, CustomerOrders, ProductReview) ---------- */

export type Address = { id: number; name: string; governorate: string; city: string | null; address: string; is_default: boolean };
export type Profile = { name: string | null; email: string | null; phone: string; addresses: Address[] };
export type AddressInput = { name: string; governorate: string; city: string | null; address: string; is_default?: boolean };

export type OrderRow = { order_number: number; created_at: string; stage: TrackStage; total: number; items_count: number; products: string[] };
export type OrderDetail = OrderRow & {
  history: Array<{ stage: TrackStage; at: string }>;
  items: Array<{
    product_id: number | null;
    name: string;
    slug: string | null;
    image: Record<string, string> | null;
    options: string[];
    quantity: number;
    total: number;
    is_gift: boolean;
    can_review: boolean;
    review: { rating: number; text: string | null } | null;
  }>;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  customer_name: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  shipping_company: string | null;
  tracking_number: string | null;
};

export type Review = { id: number; name: string; rating: number; text: string | null; verified: boolean; created_at: string };
export type ReviewSummary = { average: number; count: number; stars: Record<string, number> };
export type ReviewsPage = { data: Review[]; meta: { current_page: number; last_page: number; summary: ReviewSummary } };

/* ---------- Calls (through this store's own /api/public/store/account) ---------- */

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ data: T; meta?: unknown }> {
  let response: Response;
  try {
    response = await fetch(`/api/public/store/account${path}`, {
      method: init.method ?? "GET",
      headers: { Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, {});
  }
  if (response.status === 204) return { data: undefined as T };
  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & { data?: T; meta?: unknown };
  if (!response.ok) throw new ApiError(response.status, json);
  return { data: json.data as T, meta: json.meta };
}

export const accountKeys = {
  me: ["store-account"] as const,
  orders: (page: number) => ["store-account", "orders", page] as const,
  order: (number: number) => ["store-account", "order", number] as const,
  myReview: (productId: number) => ["store-account", "review", productId] as const,
};

/** The signed-in customer, or null when nobody is signed in on this store. */
export function useAccount() {
  return useQuery({
    queryKey: accountKeys.me,
    queryFn: async () => {
      try {
        return (await call<Profile>("")).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useMyOrders(page: number, enabled = true) {
  return useQuery({
    queryKey: accountKeys.orders(page),
    queryFn: async () => {
      const res = await call<OrderRow[]>(`/orders?page=${page}`);
      return { data: res.data, meta: res.meta as { current_page: number; last_page: number; total: number } };
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMyOrder(number: number) {
  return useQuery({ queryKey: accountKeys.order(number), queryFn: async () => (await call<OrderDetail>(`/orders/${number}`)).data });
}

export const sendCode = async (phone: string) => (await call<{ channel: string; expires_in: number; resend_in: number; code: string | null }>("/code", { method: "POST", body: { phone } })).data;
export const verifyCode = async (phone: string, code: string) => (await call<{ customer: Profile }>("/verify", { method: "POST", body: { phone, code } })).data;
export const signOut = () => call<void>("/sign-out", { method: "POST", body: {} });
export const updateProfile = async (name: string, email: string | null) => (await call<Profile>("", { method: "PUT", body: { name, email } })).data;
export const saveAddress = async (input: AddressInput, id?: number) => (await call<Address>(id ? `/addresses/${id}` : "/addresses", { method: id ? "PUT" : "POST", body: input })).data;
export const deleteAddress = (id: number) => call<void>(`/addresses/${id}`, { method: "DELETE" });
export const writeReview = async (input: { product_id: number; rating: number; text: string | null }) => (await call<{ rating: number; text: string | null }>("/reviews", { method: "PUT", body: input })).data;

/** Can I review this product (a delivered order has it), and my review if I wrote one. */
export function useMyReview(productId: number, enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.myReview(productId),
    queryFn: async () => (await call<{ can_review: boolean; review: { rating: number; text: string | null } | null }>(`/reviews?product_id=${productId}`)).data,
    enabled,
  });
}

export async function fetchReviews(slug: string, page: number): Promise<ReviewsPage> {
  const response = await fetch(`/api/public/store/reviews?slug=${encodeURIComponent(slug)}&page=${page}`, { headers: { Accept: "application/json" } });
  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & Partial<ReviewsPage>;
  if (!response.ok) throw new ApiError(response.status, json);
  return json as ReviewsPage;
}
