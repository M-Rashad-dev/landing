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

export type AiPlanSection = {
  type: string;
  title: string;
  purpose?: string;
  key?: string;
  request?: string;
  enabled?: boolean;
};

export type AiPlanImage = {
  id: string;
  action: "remove_bg" | "studio" | "enhance" | "generate" | "stock";
  upload?: number;
  prompt?: string;
  use?: string;
};

export type AiPlanPayload = {
  summary: string;
  style: {
    colors: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
    };
    font: string;
    mood: string;
    dark: boolean;
  };
  sections: AiPlanSection[];
  images: AiPlanImage[];
  notes?: string;
};

export type AiRunStatus =
  | "queued"
  | "images"
  | "sections"
  | "design"
  | "proposed"
  | "applied"
  | "rejected"
  | "failed";

export const ACTIVE_RUN_STATUSES: AiRunStatus[] = ["queued", "images", "sections", "design"];

export type AiRunPayload = {
  id: number;
  chat_id: number;
  status: AiRunStatus;
  progress: string | null;
  plan: AiPlanPayload | null;
  image_results: Record<string, number | string> | null;
  section_ids: Record<string, number> | null;
  proposal: Record<string, unknown> | null;
  applied_at: string | null;
  reverted_at: string | null;
  can_revert: boolean;
  error: string | null;
  created_at: string | null;
  preview_data?: Record<string, unknown>;
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
  plan?: AiPlanPayload | null;
  run_id?: number | null;
  run?: AiRunPayload | null;
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

export const designRunKey = (runId: number | null) =>
  ["ai-designer", "run", runId] as const;

export function useDesignerStatus() {
  return useQuery({
    queryKey: designerStatusKey,
    queryFn: () => api<{ enabled: boolean; stock?: boolean }>("/dashboard/ai/designer/status"),
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
      const activeRun = data.messages.find(
        (m) => m.run && ACTIVE_RUN_STATUSES.includes(m.run.status),
      );
      if (!pending && !activeRun) return false;
      const targetTime = pending?.created_at ?? activeRun?.run?.created_at;
      if (targetTime) {
        const elapsedMs = Date.now() - Date.parse(targetTime);
        if (!Number.isNaN(elapsedMs) && elapsedMs > 300_000) {
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

export function startDesignRun(
  messageId: number,
  custom: Record<string, boolean>,
): Promise<AiRunPayload> {
  return api<AiRunPayload>(`/dashboard/ai/designer/messages/${messageId}/run`, {
    method: "POST",
    body: { custom },
  });
}

export function useDesignRun(runId: number | null, enabled = true) {
  return useQuery({
    queryKey: designRunKey(runId),
    queryFn: () => api<AiRunPayload>(`/dashboard/ai/designer/runs/${runId}`),
    enabled: enabled && runId !== null,
  });
}

export function applyDesignRun(
  runId: number,
  version: number,
): Promise<{ run: AiRunPayload; version: number }> {
  return api<{ run: AiRunPayload; version: number }>(
    `/dashboard/ai/designer/runs/${runId}/apply`,
    {
      method: "POST",
      body: { version },
    },
  );
}

export function rejectDesignRun(runId: number): Promise<{ run: AiRunPayload }> {
  return api<{ run: AiRunPayload }>(`/dashboard/ai/designer/runs/${runId}/reject`, {
    method: "POST",
  });
}

export function revertDesignRun(
  runId: number,
  version: number,
): Promise<{ run: AiRunPayload; version: number }> {
  return api<{ run: AiRunPayload; version: number }>(
    `/dashboard/ai/designer/runs/${runId}/revert`,
    {
      method: "POST",
      body: { version },
    },
  );
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
