"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { DiscountCode, Offer, Quote, Redemption } from "@/lib/types";

export const offerKeys = { all: ["offers"] as const, list: (p: object) => ["offers", "list", p] as const };
export const codeKeys = {
  all: ["discount-codes"] as const,
  list: (p: object) => ["discount-codes", "list", p] as const,
  redemptions: (id: number, page: number) => ["discount-codes", id, "redemptions", page] as const,
};

export function useOffers(params: { status?: string; page?: number }) {
  const query = { status: params.status ?? "", page: params.page ?? 1 };
  return useQuery({
    queryKey: offerKeys.list(query),
    queryFn: ({ signal }) => apiPage<Offer>("/dashboard/offers", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useDiscountCodes(params: { status?: string; q?: string; page?: number }) {
  const query = { status: params.status ?? "", q: params.q ?? "", page: params.page ?? 1 };
  return useQuery({
    queryKey: codeKeys.list(query),
    queryFn: ({ signal }) => apiPage<DiscountCode>("/dashboard/discount-codes", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useRedemptions(id: number | null, page = 1) {
  return useQuery({
    queryKey: codeKeys.redemptions(id ?? 0, page),
    queryFn: ({ signal }) => apiPage<Redemption>(`/dashboard/discount-codes/${id}/redemptions`, { query: { page }, signal }),
    enabled: id !== null,
  });
}

export type OfferPayload = {
  name: string;
  type: Offer["type"];
  value: string | number | null;
  bundle_quantity: number | null;
  bundle_price: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  badge_text: string | null;
  priority: number;
  product_ids: number[];
};

export type CodePayload = {
  code: string;
  type: DiscountCode["type"];
  value: string | number;
  max_discount: string | null;
  min_order_total: string | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_limit_per_phone: number | null;
  stackable_with_offers: boolean;
  is_active: boolean;
  product_ids: number[];
};

export const saveOffer = (payload: OfferPayload, id?: number) =>
  id ? api<Offer>(`/dashboard/offers/${id}`, { method: "PUT", body: payload }) : api<Offer>("/dashboard/offers", { method: "POST", body: payload });
export const toggleOffer = (id: number) => api<Offer>(`/dashboard/offers/${id}/toggle`, { method: "POST" });
export const deleteOffer = (id: number) => api<void>(`/dashboard/offers/${id}`, { method: "DELETE" });

export const saveCode = (payload: CodePayload, id?: number) =>
  id ? api<DiscountCode>(`/dashboard/discount-codes/${id}`, { method: "PUT", body: payload }) : api<DiscountCode>("/dashboard/discount-codes", { method: "POST", body: payload });
export const toggleCode = (id: number) => api<DiscountCode>(`/dashboard/discount-codes/${id}/toggle`, { method: "POST" });
export const deleteCode = (id: number) => api<void>(`/dashboard/discount-codes/${id}`, { method: "DELETE" });

export type PreviewInput = { product_id: number; quantity: number; options: Record<string, number>; code?: string | null; at?: string | null; phone?: string | null };
export const previewPrice = (input: PreviewInput) => api<Quote>("/dashboard/pricing/preview", { method: "POST", body: input });

/** 8 random letters/digits without ambiguous characters (0/O, 1/I). */
export function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
