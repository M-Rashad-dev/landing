"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { api, apiPage } from "@/lib/api/client";
import { useRealtime } from "@/lib/realtime/realtime";

/** A card under an assistant reply, built by the server (docs/plans/ai-copilot.md §3.8). Unknown types render nothing. */
export type CopilotTableColumn = { key: string; label: string; kind: string };

/** The source a table came from: «نزّل إكسيل» builds the same list / report on the server. */
export type CopilotExportSource = { resource: string; filters?: Record<string, unknown>; sort?: string | null } | { report: string; params?: Record<string, unknown> };

export type CopilotHandoffBlock = { type: "handoff"; target: "designer" | "page"; label: string; href: string };
export type CopilotTableBlock = { type: "table"; title: string; columns: CopilotTableColumn[]; rows: Record<string, string | number | null>[]; total: number; export?: CopilotExportSource; link?: string | null };
export type CopilotExportBlock = { type: "export"; token: string; filename: string; rows: number };

export type CopilotChangeSetBlock = { type: "change_set"; id: number };

export type CopilotBlock = CopilotHandoffBlock | CopilotTableBlock | CopilotExportBlock | CopilotChangeSetBlock | { type: string; [key: string]: unknown };

export type ChangeStatus = "estimate" | "running" | "proposed" | "applying" | "applied" | "rejected" | "expired" | "failed" | "reverted";
export type ChangeItemStatus = "pending" | "applied" | "skipped_stale" | "skipped_invalid" | "failed" | "reverted" | "kept";

export type ChangeItem = {
  id: number;
  entity_id: number | null;
  label: string;
  url: string | null;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
  status: ChangeItemStatus;
  note: string | null;
};

/** One change the copilot prepared (§3.6): drafts to publish, or a preview to apply; the merchant's buttons decide. */
export type ChangeSet = {
  id: number;
  kind: "create" | "update" | "action" | "revert" | "job";
  target: string;
  target_label: string;
  summary: string;
  status: ChangeStatus;
  keep_draft: boolean;
  reversible: boolean;
  items_count: number;
  applied_count: number;
  skipped_count: number;
  failed_count: number;
  counts: Partial<Record<ChangeItemStatus, number>>;
  columns: CopilotTableColumn[];
  items: ChangeItem[];
  has_more_items: boolean;
  link: string | null;
  error: string | null;
  can: { accept: boolean; reject: boolean; revert: boolean };
  expires_at: string | null;
  applied_at: string | null;
  reverted_at: string | null;
  created_at: string | null;
};

export type ChangeItemsPage = { columns: CopilotTableColumn[]; items: ChangeItem[]; total: number; page: number; last_page: number };

export type CopilotMessage = {
  id: number;
  role: "user" | "assistant";
  text: string | null;
  media: { id: number; url: string }[];
  blocks: CopilotBlock[];
  status: "pending" | "done" | "failed";
  progress: string | null;
  error: string | null;
  error_code: string | null;
  created_at: string | null;
};

export type CopilotChat = {
  chat: { id: number; title: string | null; closed: boolean; created_at: string | null };
  messages: CopilotMessage[];
  has_more: boolean;
};

/** Where the merchant is: the page, the record open on it, the rows selected (§3.9). */
export type CopilotPageContext = {
  page?: string;
  entity?: { type: string; id: number };
  selection?: { type: string; ids: number[] };
};

export const copilotStatusKey = ["copilot", "status"] as const;
export const copilotChatKey = ["copilot", "chat"] as const;
export const changeSetKey = (id: number) => ["copilot", "change-set", id] as const;

/** Stop polling a reply after this long (the server marks it failed after 5 minutes). */
const POLL_LIMIT_MS = 300_000;

export function useCopilotStatus() {
  return useQuery({
    queryKey: copilotStatusKey,
    queryFn: () => api<{ enabled: boolean }>("/dashboard/ai/copilot/status"),
    staleTime: 60_000,
  });
}

function waiting(data: CopilotChat | undefined): boolean {
  const pending = data?.messages.find((m) => m.status === "pending");
  if (!pending) return false;
  const started = pending.created_at ? Date.parse(pending.created_at) : Number.NaN;
  return Number.isNaN(started) || Date.now() - started < POLL_LIMIT_MS;
}

/**
 * The open chat. Realtime («copilot.updated» on the user's channel) refetches at once; while a reply is pending
 * it also polls every 3 s as a fallback (realtime off or a dropped connection).
 */
export function useCopilotChat(userId: number, enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: copilotChatKey,
    queryFn: () => api<CopilotChat>("/dashboard/ai/copilot/chat", { method: "POST" }),
    enabled,
    refetchInterval: (q) => (waiting(q.state.data) ? 3000 : false),
  });
  const refetch = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: copilotChatKey });
    void queryClient.invalidateQueries({ queryKey: ["copilot", "change-set"] });
    void queryClient.invalidateQueries({ queryKey: ["copilot", "history"] });
  }, [queryClient]);
  useRealtime(enabled ? `user.${userId}` : null, "copilot.updated", refetch, refetch);
  return query;
}

export function sendCopilotMessage(chatId: number, body: { text: string; media_ids?: number[]; context?: CopilotPageContext }): Promise<CopilotMessage> {
  return api<CopilotMessage>(`/dashboard/ai/copilot/chats/${chatId}/messages`, { method: "POST", body });
}

export function newCopilotChat(): Promise<CopilotChat> {
  return api<CopilotChat>("/dashboard/ai/copilot/chat/new", { method: "POST" });
}

/** Builds the Excel file of a table's source (free, no AI). */
export function buildCopilotExport(source: CopilotExportSource, filename?: string): Promise<CopilotExportBlock> {
  return api<CopilotExportBlock>("/dashboard/ai/copilot/exports", { method: "POST", body: { source, filename } });
}

/** A copilot file, downloaded through the BFF with the session. */
export const copilotExportUrl = (token: string) => `/api/bff/dashboard/ai/copilot/exports/${token}`;

export function olderCopilotMessages(chatId: number, before: number): Promise<CopilotChat> {
  return api<CopilotChat>(`/dashboard/ai/copilot/chats/${chatId}`, { query: { before } });
}

/** A change card's data; polls while it is being applied (realtime refreshes it too). */
export function useChangeSet(id: number) {
  return useQuery({
    queryKey: changeSetKey(id),
    queryFn: () => api<ChangeSet>(`/dashboard/ai/copilot/change-sets/${id}`),
    refetchInterval: (q) => (q.state.data?.status === "applying" || q.state.data?.status === "running" ? 2000 : false),
  });
}

export function changeSetItems(id: number, page: number, status?: ChangeItemStatus): Promise<ChangeItemsPage> {
  return api<ChangeItemsPage>(`/dashboard/ai/copilot/change-sets/${id}/items`, { query: { page, status } });
}

export function acceptChangeSet(id: number): Promise<ChangeSet> {
  return api<ChangeSet>(`/dashboard/ai/copilot/change-sets/${id}/accept`, { method: "POST" });
}

export function rejectChangeSet(id: number): Promise<ChangeSet> {
  return api<ChangeSet>(`/dashboard/ai/copilot/change-sets/${id}/reject`, { method: "POST" });
}

export function revertChangeSet(id: number): Promise<ChangeSet> {
  return api<ChangeSet>(`/dashboard/ai/copilot/change-sets/${id}/revert`, { method: "POST" });
}

export const changeSetFileUrl = (id: number) => `/api/bff/dashboard/ai/copilot/change-sets/${id}/items/file`;

/** The history page: every change, newest first. */
export function useChangeSets(page: number, status?: ChangeStatus) {
  return useQuery({
    queryKey: ["copilot", "history", page, status ?? "all"],
    queryFn: () => apiPage<ChangeSet>("/dashboard/ai/copilot/change-sets", { query: { page, status } }),
  });
}
