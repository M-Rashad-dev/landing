"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AiDefinition, AiSectionProps } from "@/themes/shared/ai-section/types";

export type MyAiSection = {
  id: number;
  name: string;
  updated_at: string | null;
  current: AiDefinition;
};

export const mySectionsKey = (kind: "store" | "landing", themeKey: string) =>
  ["ai-designer", "sections", kind, themeKey] as const;

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
