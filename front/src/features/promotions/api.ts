"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export type PromoStatus = "active" | "scheduled" | "expired" | "inactive";
export const STATUS_FILTERS = ["all", "active", "scheduled", "expired", "inactive"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type Target = "all" | "products" | "categories";
export type Named = { id: number; name: string };

type Scoped = {
  applies_to: Target;
  products?: Array<Named & { price?: number }>;
  product_ids?: number[];
  categories?: Named[];
  category_ids?: number[];
};

type Timed = { starts_at: string | null; ends_at: string | null; is_active: boolean; status: PromoStatus };

/* ---------- product offers ---------- */

export type OfferType = "percentage" | "fixed" | "bundle" | "buy_get" | "gift";
export const OFFER_TYPES: OfferType[] = ["percentage", "fixed", "bundle", "buy_get", "gift"];

export type Offer = Scoped &
  Timed & {
    id: number;
    name: string;
    type: OfferType;
    value: number | null;
    min_quantity: number;
    free_quantity: number | null;
    gift_product_id: number | null;
    gift_product: (Named & { price: number }) | null;
    bundle_quantity: number | null;
    bundle_price: number | null;
    badge_text: string | null;
    priority: number;
    locked_by_plan: boolean;
  };

/* ---------- shipping offers ---------- */

export type Benefit = "free" | "discount" | "flat";
export const BENEFITS: Benefit[] = ["free", "discount", "flat"];

export type ShippingOffer = Scoped &
  Timed & {
    id: number;
    name: string;
    benefit: Benefit;
    value: number | null;
    min_quantity: number | null;
    min_total: number | null;
    governorates: string[];
    company_ids: number[];
  };

/* ---------- discount codes ---------- */

export type CouponType = "percentage" | "fixed" | "free_shipping";
export const COUPON_TYPES: CouponType[] = ["percentage", "fixed", "free_shipping"];

export type Coupon = Scoped &
  Timed & {
    id: number;
    code: string;
    type: CouponType;
    value: number | null;
    max_discount: number | null;
    min_order_total: number | null;
    min_quantity: number | null;
    first_order_only: boolean;
    usage_limit: number | null;
    usage_limit_per_phone: number | null;
    used_count: number;
    remaining: number | null;
    stackable_with_offers: boolean;
    locked_by_plan: boolean;
  };

export type Redemption = { id: number; order_id: number | null; phone: string; amount: number; released_at: string | null; created_at: string };

export type ListFilters = { q: string; status: StatusFilter; page: number };

const RESOURCES = { offers: "/dashboard/offers", shippingOffers: "/dashboard/shipping-offers", coupons: "/dashboard/discount-codes" } as const;
type Resource = keyof typeof RESOURCES;

export const promoKeys = {
  all: (r: Resource) => [r] as const,
  list: (r: Resource, f: ListFilters) => [r, "list", f] as const,
};

function useList<T>(resource: Resource, filters: ListFilters) {
  return useQuery({
    queryKey: promoKeys.list(resource, filters),
    queryFn: () => apiPage<T>(RESOURCES[resource], { query: { q: filters.q, status: filters.status === "all" ? null : filters.status, page: filters.page, per_page: 20 } }),
    placeholderData: keepPreviousData,
  });
}

export const useOffers = (f: ListFilters) => useList<Offer>("offers", f);
export const useShippingOffers = (f: ListFilters) => useList<ShippingOffer>("shippingOffers", f);
export const useCoupons = (f: ListFilters) => useList<Coupon>("coupons", f);

/** Totals for the tabs (one light request each). */
export function useCount(resource: Resource) {
  return useQuery({ queryKey: [resource, "count"], queryFn: async () => (await apiPage<unknown>(RESOURCES[resource], { query: { per_page: 1 } })).meta.total });
}

export function useRefresh(resource: Resource) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: promoKeys.all(resource) });
}

export const saveOffer = (body: Record<string, unknown>, id?: number) => api<Offer>(id ? `${RESOURCES.offers}/${id}` : RESOURCES.offers, { method: id ? "PUT" : "POST", body });
export const saveShippingOffer = (body: Record<string, unknown>, id?: number) => api<ShippingOffer>(id ? `${RESOURCES.shippingOffers}/${id}` : RESOURCES.shippingOffers, { method: id ? "PUT" : "POST", body });
export const saveCoupon = (body: Record<string, unknown>, id?: number) => api<Coupon>(id ? `${RESOURCES.coupons}/${id}` : RESOURCES.coupons, { method: id ? "PUT" : "POST", body });

export const togglePromo = (resource: Resource, id: number) => api<{ is_active: boolean }>(`${RESOURCES[resource]}/${id}/toggle`, { method: "POST" });
export const deletePromo = (resource: Resource, id: number) => api<void>(`${RESOURCES[resource]}/${id}`, { method: "DELETE" });

export function useRedemptions(couponId: number | null) {
  return useQuery({
    queryKey: ["coupons", "redemptions", couponId],
    queryFn: () => apiPage<Redemption>(`${RESOURCES.coupons}/${couponId}/redemptions`, { query: { per_page: 50 } }),
    enabled: couponId !== null,
  });
}

/** Products to pick from (the first 100 by name; the list endpoint caps a page at 100). */
export function useProductChoices() {
  return useQuery({
    queryKey: ["products", "choices"],
    queryFn: async () => (await apiPage<Named & { price: number }>("/dashboard/products", { query: { per_page: 100, sort: "name" } })).data,
    staleTime: 60_000,
  });
}

export type { Paginated };
