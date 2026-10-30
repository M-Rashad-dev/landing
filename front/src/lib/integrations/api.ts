"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";

export type IntegrationKind = "webhook" | "google_sheets";
export type IntegrationEvent = "order.created" | "order.status_changed" | "order.updated" | "lead.created";

export type Integration = {
  id: number;
  kind: IntegrationKind;
  name: string;
  url: string;
  secret: string;
  events: IntegrationEvent[];
  is_active: boolean;
  failures_count: number;
  last_status: "success" | "failed" | null;
  last_delivery_at: string | null;
};

export type Delivery = { id: number; event: string; status: "success" | "failed"; response_code: number | null; error: string | null; attempt: number; duration_ms: number; created_at: string };

export type IntegrationPayload = { kind?: IntegrationKind; name: string; url: string; events: IntegrationEvent[] };

export const integrationKeys = { all: ["integrations"] as const, deliveries: (id: number) => ["integrations", id, "deliveries"] as const };

export function useIntegrations() {
  return useQuery({ queryKey: integrationKeys.all, queryFn: ({ signal }) => apiPage<Integration>("/dashboard/integrations", { signal }) });
}

export function useDeliveries(id: number, enabled: boolean) {
  return useQuery({ queryKey: integrationKeys.deliveries(id), queryFn: () => api<Delivery[]>(`/dashboard/integrations/${id}/deliveries`), enabled });
}

export const saveIntegration = (payload: IntegrationPayload, id?: number) => api<Integration>(id ? `/dashboard/integrations/${id}` : "/dashboard/integrations", { method: id ? "PUT" : "POST", body: payload });
export const toggleIntegration = (id: number) => api<Integration>(`/dashboard/integrations/${id}/toggle`, { method: "POST" });
export const rotateSecret = (id: number) => api<Integration>(`/dashboard/integrations/${id}/rotate-secret`, { method: "POST" });
export const testIntegration = (id: number) => api<{ delivery: Delivery; webhook: Integration }>(`/dashboard/integrations/${id}/test`, { method: "POST" });
export const deleteIntegration = (id: number) => api<void>(`/dashboard/integrations/${id}`, { method: "DELETE" });

/** Google Sheets writes orders; leads are not rows in the orders sheet. */
export const SHEETS_EVENTS: IntegrationEvent[] = ["order.created", "order.status_changed", "order.updated"];
