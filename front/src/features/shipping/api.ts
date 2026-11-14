"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { MediaUrls } from "@/features/media/api";

export type Rate = { governorate: string; fee: number | null; is_available: boolean };

export type Company = {
  id: number;
  name: string;
  media_id: number | null;
  logo: MediaUrls | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  default_fee: number;
  is_active: boolean;
  position: number;
  served_count: number;
  rates: Rate[];
};

export type ShippingSettings = { enabled: boolean; governorates: string[]; companies: Company[] };

export type CompanyInput = {
  name: string;
  media_id: number | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  default_fee: string;
  is_active: boolean;
  rates: Array<{ governorate: string; fee: string | null; is_available: boolean }>;
};

export const shippingKeys = { all: ["shipping"] as const };

export function useShipping() {
  return useQuery({ queryKey: shippingKeys.all, queryFn: () => api<ShippingSettings>("/dashboard/shipping") });
}

export function useRefreshShipping() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: shippingKeys.all });
}

export const setShippingEnabled = (enabled: boolean) => api<ShippingSettings>("/dashboard/shipping", { method: "PUT", body: { enabled } });
export const saveCompany = (body: CompanyInput, id?: number) => api<Company>(id ? `/dashboard/shipping-companies/${id}` : "/dashboard/shipping-companies", { method: id ? "PUT" : "POST", body });
export const toggleCompany = (id: number) => api<Company>(`/dashboard/shipping-companies/${id}/toggle`, { method: "POST" });
export const deleteCompany = (id: number) => api<void>(`/dashboard/shipping-companies/${id}`, { method: "DELETE" });
export const reorderCompanies = (ids: number[]) => api<void>("/dashboard/shipping-companies/order", { method: "PUT", body: { ids } });
