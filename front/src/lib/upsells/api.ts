"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type Upsell = {
  id: number;
  name: string;
  trigger_product: { id: number; name: string } | null;
  offer_product: { id: number; name: string; price: number };
  price: number;
  headline: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  accepted_count: number;
  accepted_revenue: number;
  created_at: string | null;
};

export type UpsellPayload = {
  name: string;
  trigger_product_id: number | null;
  offer_product_id: number;
  price: string;
  headline: string;
  description: string | null;
  priority: number;
  is_active: boolean;
};

export const upsellKeys = { all: ["upsells"] as const };

export function useUpsells() {
  return useQuery({ queryKey: upsellKeys.all, queryFn: () => api<Upsell[]>("/dashboard/upsells") });
}

export const saveUpsell = (payload: UpsellPayload, id?: number) => api<Upsell>(id ? `/dashboard/upsells/${id}` : "/dashboard/upsells", { method: id ? "PUT" : "POST", body: payload });
export const toggleUpsell = (id: number) => api<Upsell>(`/dashboard/upsells/${id}/toggle`, { method: "POST" });
export const deleteUpsell = (id: number) => api<void>(`/dashboard/upsells/${id}`, { method: "DELETE" });
