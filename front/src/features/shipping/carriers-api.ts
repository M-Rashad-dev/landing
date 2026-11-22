"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** Shipping carriers the store connects with its own account (Bosta…), and the shipments sent through them. */

export type CarrierSettings = {
  location_id: string | null;
  allow_open: boolean;
  package_type: "Parcel" | "Document" | "Light Bulky" | "Heavy Bulky";
  size: "SMALL" | "MEDIUM" | "LARGE";
  label_size: "A4" | "A6";
  auto_ship: boolean;
  notes: string | null;
};

export type CarrierAccount = {
  id: number;
  carrier: string;
  mode: "own" | "platform";
  account_name: string | null;
  status: "active" | "failed";
  last_error: string | null;
  checked_at: string | null;
  settings: CarrierSettings;
  company: { id: number; name: string; is_active: boolean } | null;
  open_shipments: number;
};

export type Carrier = { key: string; name: string; account: CarrierAccount | null };
export type CarrierLocation = { id: string; name: string; is_default: boolean };

export type ShipmentState = "created" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "returning" | "returned" | "exception" | "cancelled" | "lost" | "damaged";

export type Shipment = {
  id: number;
  order_id: number;
  carrier: string;
  carrier_name: string;
  connected: boolean;
  tracking_number: string;
  state: ShipmentState;
  state_label: string;
  carrier_label: string | null;
  cod: number;
  exception: string | null;
  attempts: number;
  is_open: boolean;
  can_cancel: boolean;
  synced_at: string | null;
  created_at: string | null;
  events?: Array<{ state: ShipmentState; state_label: string; carrier_label: string | null; note: string | null; at: string }>;
};

export type ShipPrepare = {
  carriers: Array<{ carrier: string; name: string; account: CarrierAccount }>;
  default_carrier: string | null;
  area: { matched: string | null; districts: Array<{ id: string; name: string }>; error: string | null };
  cod: number;
  items_count: number;
  can_ship: boolean;
  shipment: Shipment | null;
};

export type ShipInput = { carrier: string; district_id?: string | null; cod?: string | null; items_count?: number | null; notes?: string | null; allow_open?: boolean | null };
export type BulkResult = { order_id: number; order_number: number; ok: boolean; shipment_id?: number; tracking_number?: string; code?: string; error?: string };

export const carrierKeys = { all: ["carriers"] as const, prepare: (orderId: number) => ["carriers", "prepare", orderId] as const, locations: (key: string) => ["carriers", "locations", key] as const };

export function useCarriers() {
  return useQuery({ queryKey: carrierKeys.all, queryFn: () => api<Carrier[]>("/dashboard/shipping/carriers") });
}

export function useRefreshCarriers() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: carrierKeys.all });
}

/** «اختبر الربط»: the key checked again, with the pickup locations to choose from. */
export function useCarrierLocations(key: string, enabled: boolean) {
  return useQuery({
    queryKey: carrierKeys.locations(key),
    queryFn: () => api<{ account: CarrierAccount; locations: CarrierLocation[] }>(`/dashboard/shipping/carriers/${key}/check`, { method: "POST" }),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useShipPrepare(orderId: number, enabled: boolean, carrier: string | null = null) {
  return useQuery({
    queryKey: [...carrierKeys.prepare(orderId), carrier],
    queryFn: () => api<ShipPrepare>(`/dashboard/orders/${orderId}/shipping${carrier ? `?carrier=${encodeURIComponent(carrier)}` : ""}`),
    enabled,
    retry: false,
  });
}

export const connectCarrier = (key: string, body: { api_key: string; company_id: number | null }) => api<CarrierAccount>(`/dashboard/shipping/carriers/${key}`, { method: "POST", body });
export const saveCarrierSettings = (key: string, body: Partial<CarrierSettings>) => api<CarrierAccount>(`/dashboard/shipping/carriers/${key}`, { method: "PUT", body });
export const checkCarrier = (key: string) => api<{ account: CarrierAccount; locations: CarrierLocation[] }>(`/dashboard/shipping/carriers/${key}/check`, { method: "POST" });
export const disconnectCarrier = (key: string) => api<void>(`/dashboard/shipping/carriers/${key}`, { method: "DELETE" });
export const requestPickup = (key: string, body: { date: string; parcels: number; notes: string | null }) => api<void>(`/dashboard/shipping/carriers/${key}/pickups`, { method: "POST", body });

export const shipOrder = (orderId: number, body: ShipInput) => api<Shipment>(`/dashboard/orders/${orderId}/shipments`, { method: "POST", body });
export const shipBulk = (orderIds: number[], carrier?: string) => api<BulkResult[]>("/dashboard/shipments/bulk", { method: "POST", body: { order_ids: orderIds, ...(carrier ? { carrier } : {}) } });
export const cancelShipment = (id: number) => api<Shipment>(`/dashboard/shipments/${id}/cancel`, { method: "POST" });
export const refreshShipment = (id: number) => api<Shipment>(`/dashboard/shipments/${id}/refresh`, { method: "POST" });

/** The airway bills PDF (opened in a new tab: the BFF passes the file through). */
export function labelsUrl(target: { shipmentIds?: number[]; orderIds?: number[] }, size?: "A4" | "A6"): string {
  const params = new URLSearchParams();
  for (const id of target.shipmentIds ?? []) params.append("ids[]", String(id));
  for (const id of target.orderIds ?? []) params.append("order_ids[]", String(id));
  if (size) params.set("size", size);
  return `/api/bff/dashboard/shipments/labels?${params.toString()}`;
}

/** Badge tone per state (the same everywhere: order page, list, tracking). */
export function stateTone(state: ShipmentState): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "delivered") return "success";
  if (state === "exception" || state === "returning") return "warning";
  if (state === "lost" || state === "damaged" || state === "returned") return "danger";
  if (state === "cancelled") return "neutral";
  return "info";
}
