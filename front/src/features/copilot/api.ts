"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { api } from "@/lib/api/client";
import { useRealtime } from "@/lib/realtime/realtime";

/** A card under an assistant reply, built by the server (docs/plans/ai-copilot.md §3.8). Unknown types render nothing. */
export type CopilotBlock =
  | { type: "handoff"; target: "designer" | "page"; label: string; href: string }
  | { type: string; [key: string]: unknown };

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
  const refetch = React.useCallback(() => void queryClient.invalidateQueries({ queryKey: copilotChatKey }), [queryClient]);
  useRealtime(enabled ? `user.${userId}` : null, "copilot.updated", refetch, refetch);
  return query;
}

export function sendCopilotMessage(chatId: number, body: { text: string; media_ids?: number[]; context?: CopilotPageContext }): Promise<CopilotMessage> {
  return api<CopilotMessage>(`/dashboard/ai/copilot/chats/${chatId}/messages`, { method: "POST", body });
}

export function newCopilotChat(): Promise<CopilotChat> {
  return api<CopilotChat>("/dashboard/ai/copilot/chat/new", { method: "POST" });
}

export function olderCopilotMessages(chatId: number, before: number): Promise<CopilotChat> {
  return api<CopilotChat>(`/dashboard/ai/copilot/chats/${chatId}`, { query: { before } });
}
