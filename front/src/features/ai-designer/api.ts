"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AiDefinition, AiField, AiSectionProps } from "@/themes/shared/ai-section/types";
import type { MediaUrls } from "@/themes/shared/design";

export type MyAiSection = {
  id: number;
  name: string;
  updated_at: string | null;
  current: AiDefinition;
};

export type AiVersionStatus = "proposed" | "approved" | "rejected" | "replaced";

export type AiVersionPayload = {
  id: number;
  ai_section_id: number | null;
  name: string;
  html: string;
  css: string;
  fields: AiField[];
  status: AiVersionStatus;
};

export type AiMessageMedia = {
  id: number;
  url: string;
  urls?: MediaUrls;
};

export type AiChatMessagePayload = {
  id: number;
  role: "user" | "assistant";
  text: string | null;
  media: AiMessageMedia[];
  status: "pending" | "done" | "failed";
  error: string | null;
  focus_section_id: number | null;
  version: AiVersionPayload | null;
  created_at: string | null;
};

export type AiChatPayload = {
  chat: {
    id: number;
    kind: "store" | "landing";
    theme_key: string;
    landing_page_id: number | null;
    closed_at: string | null;
  };
  messages: AiChatMessagePayload[];
};

export const designerStatusKey = ["ai-designer", "status"] as const;

export const mySectionsKey = (kind: "store" | "landing", themeKey: string) =>
  ["ai-designer", "sections", kind, themeKey] as const;

export const designerChatKey = (chatId: number | null) =>
  ["ai-designer", "chat", chatId] as const;

export function useDesignerStatus() {
  return useQuery({
    queryKey: designerStatusKey,
    queryFn: () => api<{ enabled: boolean }>("/dashboard/ai/designer/status"),
    staleTime: 30_000,
  });
}

export function useMySections(kind: "store" | "landing", themeKey: string, enabled = true) {
  return useQuery({
    queryKey: mySectionsKey(kind, themeKey),
    queryFn: () =>
      api<MyAiSection[]>("/dashboard/ai/sections", {
        query: { kind, theme_key: themeKey },
      }),
    enabled: enabled && Boolean(themeKey),
  });
}

export function archiveSection(id: number): Promise<void> {
  return api<void>(`/dashboard/ai/sections/${id}`, { method: "DELETE" });
}

export function openChat(body: {
  kind: "store" | "landing";
  theme_key: string;
  landing_page_id?: number | null;
}): Promise<AiChatPayload> {
  return api<AiChatPayload>("/dashboard/ai/designer/chat", {
    method: "POST",
    body,
  });
}

export function newChat(body: {
  kind: "store" | "landing";
  theme_key: string;
  landing_page_id?: number | null;
}): Promise<AiChatPayload> {
  return api<AiChatPayload>("/dashboard/ai/designer/chat/new", {
    method: "POST",
    body,
  });
}

export function useChat(chatId: number | null, enabled = true) {
  return useQuery({
    queryKey: designerChatKey(chatId),
    queryFn: () => api<AiChatPayload>(`/dashboard/ai/designer/chats/${chatId}`),
    enabled: enabled && chatId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const pending = data.messages.find((m) => m.status === "pending");
      if (!pending) return false;
      if (pending.created_at) {
        const elapsedMs = Date.now() - Date.parse(pending.created_at);
        if (!Number.isNaN(elapsedMs) && elapsedMs > 180_000) {
          return false;
        }
      }
      return 2000;
    },
  });
}

export function sendMessage(
  chatId: number,
  body: {
    text: string;
    media_ids?: number[];
    focus_section_id?: number | null;
  },
): Promise<AiChatMessagePayload> {
  return api<AiChatMessagePayload>(`/dashboard/ai/designer/chats/${chatId}/messages`, {
    method: "POST",
    body,
  });
}

export function approveVersion(
  versionId: number,
): Promise<{ section: { id: number; name: string; current: AiDefinition }; version: AiVersionPayload }> {
  return api<{ section: { id: number; name: string; current: AiDefinition }; version: AiVersionPayload }>(
    `/dashboard/ai/designer/versions/${versionId}/approve`,
    { method: "POST" },
  );
}

export function rejectVersion(versionId: number): Promise<AiVersionPayload> {
  return api<AiVersionPayload>(`/dashboard/ai/designer/versions/${versionId}/reject`, {
    method: "POST",
  });
}

export function newAiPlacementId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createAiSectionPlacement(aiSectionId: number): {
  id: string;
  type: "ai";
  visible: boolean;
  props: AiSectionProps;
} {
  return {
    id: newAiPlacementId(),
    type: "ai",
    visible: true,
    props: {
      ai_section_id: aiSectionId,
      values: {},
    },
  };
}
