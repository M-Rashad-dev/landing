"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export type LeadStatus = "open" | "contacted" | "converted" | "dismissed";

export type Lead = {
  id: number;
  customer_name: string | null;
  customer_phone: string;
  governorate: string | null;
  quantity: number;
  status: LeadStatus;
  page: { id: number; title: string } | null;
  product: { id: number; name: string } | null;
  order: { id: number; number: number } | null;
  contacted_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type LeadPage = Paginated<Lead> & { meta: Paginated<Lead>["meta"] & { counts: Record<LeadStatus, number> } };

export const leadKeys = { all: ["leads"] as const, list: (params: { status: LeadStatus; page: number }) => ["leads", params] as const };

export function useLeads(params: { status: LeadStatus; page: number }) {
  return useQuery({
    queryKey: leadKeys.list(params),
    queryFn: ({ signal }) => apiPage<Lead>("/dashboard/leads", { query: params, signal }) as Promise<LeadPage>,
    placeholderData: keepPreviousData,
  });
}

export const updateLead = (id: number, status: Exclude<LeadStatus, "converted">) => api<Lead>(`/dashboard/leads/${id}`, { method: "PATCH", body: { status } });
export const deleteLead = (id: number) => api<void>(`/dashboard/leads/${id}`, { method: "DELETE" });
