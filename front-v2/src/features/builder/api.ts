"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ar } from "@/messages/ar";
import type { Design, DesignData, Section, SectionType } from "@/themes/asas/types";

export type DesignPayload = {
  theme: { key: string; name: string };
  store_name: string;
  draft: Design;
  version: number;
  published_at: string | null;
  has_unpublished_changes: boolean;
  data: DesignData;
};

export const designKey = ["store", "design"] as const;

export function useDesign() {
  return useQuery({ queryKey: designKey, queryFn: () => api<DesignPayload>("/dashboard/store/design"), refetchOnWindowFocus: false });
}

export const saveDesign = (draft: Design, version: number) => api<DesignPayload>("/dashboard/store/design", { method: "PUT", body: { draft, version } });
export const publishDesign = () => api<DesignPayload>("/dashboard/store/design/publish", { method: "POST" });

/** A section id like the back end makes them (12 hex characters). */
export function newId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const d = ar.design.builder.defaults;

/** A new section of a type, ready to edit. */
export function newSection(type: SectionType): Section {
  const id = newId();
  switch (type) {
    case "banner":
      return { id, type, visible: true, props: { slides: [], autoplay: true } };
    case "products":
      return { id, type, visible: true, props: { title: d.productsTitle, description: null, source: "latest", category_id: null, limit: 8, layout: "grid", columns: 4, show_view_all: true } };
    case "features":
      return {
        id,
        type,
        visible: true,
        props: {
          title: null,
          items: [
            { icon: "truck", title: d.featureTitle, text: null },
            { icon: "cash", title: d.featureTitle, text: null },
            { icon: "return", title: d.featureTitle, text: null },
          ],
        },
      };
    case "testimonials":
      return { id, type, visible: true, props: { title: d.testimonialsTitle, source: "auto", items: [] } };
  }
}

/** A copy of a section with a new id (its banner images and texts stay the same). */
export function copySection(section: Section): Section {
  return { ...structuredClone(section), id: newId() } as Section;
}

/** Errors of one section from the server keys (draft.sections.{i}.props.…), by the rest of the path. */
export function sectionErrors(errors: Record<string, string>, index: number): Record<string, string> {
  const prefix = `draft.sections.${index}.props.`;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
  return out;
}

/** Errors of the theme settings (draft.settings.…), by the rest of the path. */
export function settingsErrors(errors: Record<string, string>): Record<string, string> {
  const prefix = "draft.settings.";
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
  return out;
}
