"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as React from "react";
import { api, apiUpload } from "@/lib/api/client";
import { useRealtime } from "@/lib/realtime/realtime";

/** "merchant" = the store's dashboard; "support" = the platform admin. */
export type Side = "merchant" | "support";
export type TicketStatus = "waiting_support" | "waiting_merchant" | "closed";

export type Attachment = { id: number; kind: "image" | "video"; name: string; mime: string; size: number };
export type Message = { id: number; sender: "merchant" | "support" | "system"; body: string | null; created_at: string | null; attachments: Attachment[] };
export type Ticket = {
  number: number;
  topic: string;
  status: TicketStatus;
  close_reason: "merchant" | "support" | "auto" | null;
  store: { id: number; name: string | null };
  created_at: string | null;
  last_message_at: string | null;
  closed_at: string | null;
  closes_at: string | null;
  merchant_read_at: string | null;
  support_read_at: string | null;
  unread_merchant: boolean;
  unread_support: boolean;
  rating: number | null;
  rating_resolved: boolean | null;
  rating_comment: string | null;
  reopened_count: number;
  last_message: { sender: Message["sender"]; preview: string; files: number } | null;
  context?: { page?: string | null; agent?: string | null; plan?: string | null } | null;
  plan?: string | null;
};
export type Conversation = { ticket: Ticket; messages: Message[]; has_more: boolean; history?: Array<{ number: number; topic: string; status: TicketStatus; rating: number | null; created_at: string | null }> };
export type Summary = { unread: number; open: number; can_open: boolean; reason: string | null };

const BASE: Record<Side, string> = { merchant: "/dashboard/support", support: "/admin/support" };

export const supportKey = (side: Side, ...rest: Array<string | number>) => ["support", side, ...rest] as const;
export const attachmentUrl = (side: Side, id: number) => `/api/bff${BASE[side]}/attachments/${id}`;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_FILES = 5;
export const IMAGE_MAX_MB = 10;
export const VIDEO_MAX_MB = 50;

export function useConversation(side: Side, number: number | null) {
  return useQuery({
    queryKey: supportKey(side, "ticket", number ?? 0),
    queryFn: () => api<Conversation>(`${BASE[side]}/tickets/${number}`),
    enabled: number !== null,
  });
}

export function useSummary() {
  return useQuery({ queryKey: supportKey("merchant", "summary"), queryFn: () => api<Summary>("/dashboard/support/summary") });
}

export function useMerchantTickets(enabled: boolean) {
  return useQuery({ queryKey: supportKey("merchant", "list"), queryFn: () => api<Ticket[]>("/dashboard/support/tickets"), enabled });
}

export async function loadOlder(side: Side, number: number, before: number) {
  return api<Conversation>(`${BASE[side]}/tickets/${number}`, { query: { before } });
}

function form(body: string, files: File[], extra: Record<string, string> = {}) {
  const data = new FormData();
  if (body.trim()) data.append("body", body.trim());
  files.forEach((f) => data.append("files[]", f));
  for (const [k, v] of Object.entries(extra)) data.append(k, v);
  return data;
}

export const sendMessage = (side: Side, number: number, body: string, files: File[], onProgress?: (p: number) => void) =>
  apiUpload<Message>(`${BASE[side]}/tickets/${number}/messages`, form(body, files), onProgress);

export const openTicket = (topic: string, body: string, files: File[], page: string, onProgress?: (p: number) => void) =>
  apiUpload<Conversation>("/dashboard/support/tickets", form(body, files, { topic, page }), onProgress);

export const markRead = (side: Side, number: number) => api<Ticket>(`${BASE[side]}/tickets/${number}/read`, { method: "POST" });
export const closeTicket = (side: Side, number: number) => api<Ticket>(`${BASE[side]}/tickets/${number}/close`, { method: "POST" });
export const reopenTicket = (number: number) => api<Ticket>(`/admin/support/tickets/${number}/reopen`, { method: "POST" });
export const rateTicket = (number: number, rating: number, resolved: boolean, comment: string) =>
  api<Ticket>(`/dashboard/support/tickets/${number}/rating`, { method: "POST", body: { rating, resolved, comment: comment.trim() || null } });

/** Puts a new / updated message and ticket into the open conversation (no reload). */
export function applyUpdate(client: QueryClient, side: Side, ticket: Ticket, message: Message | null) {
  client.setQueryData<Conversation>(supportKey(side, "ticket", ticket.number), (current) => {
    if (!current) return current;
    const messages = message && !current.messages.some((m) => m.id === message.id) ? [...current.messages, message] : current.messages;
    return { ...current, ticket: { ...current.ticket, ...ticket, store: { ...current.ticket.store, name: ticket.store.name ?? current.ticket.store.name } }, messages };
  });
}

/**
 * Live updates of the support chat for one side: every change of a conversation refreshes the
 * open conversation, the lists and the badges. After a dropped connection everything reloads.
 */
export function useSupportLive(side: Side, tenantId: number | null) {
  const client = useQueryClient();
  const channel = side === "support" ? "support.admin" : tenantId ? `support.tenant.${tenantId}` : null;
  const onUpdate = React.useCallback(
    (payload: { ticket: Ticket; message: Message | null }) => {
      applyUpdate(client, side, payload.ticket, payload.message);
      void client.invalidateQueries({ queryKey: ["support", side], predicate: (q) => q.queryKey[2] !== "ticket" });
    },
    [client, side],
  );
  const onReconnect = React.useCallback(() => void client.invalidateQueries({ queryKey: ["support", side] }), [client, side]);
  return useRealtime(channel, "support.updated", onUpdate, onReconnect);
}

/** Checks picked files before sending; returns the problems (translated by the caller). */
export function checkFiles(files: File[]): Array<{ file: File; problem: "type" | "size" }> {
  return files.flatMap((file): Array<{ file: File; problem: "type" | "size" }> => {
    const image = IMAGE_TYPES.includes(file.type);
    const video = VIDEO_TYPES.includes(file.type);
    if (!image && !video) return [{ file, problem: "type" as const }];
    const mb = file.size / 1024 / 1024;
    return mb > (image ? IMAGE_MAX_MB : VIDEO_MAX_MB) ? [{ file, problem: "size" as const }] : [];
  });
}
