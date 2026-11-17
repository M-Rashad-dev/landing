"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ar } from "@/messages/ar";
import type { DesignData } from "@/themes/store/shared/types";
import type { Design, Section, SectionType } from "@/themes/store/asas/types";
import type { SufiSection, SufiSectionType } from "@/themes/store/sufi/types";

/** A section of any store theme («أساس» or «صوفي»). */
export type AnySection = Section | SufiSection;

export type DesignPayload = {
  /** The theme, with what the server accepts for it (the Builder offers exactly these). */
  theme: { key: string; name: string; section_types: string[]; max_sections: number; settings_groups: string[] };
  store_name: string;
  draft: Design;
  version: number;
  published_at: string | null;
  has_unpublished_changes: boolean;
  data: DesignData;
};

export const designKey = ["store", "design"] as const;

/** A store theme in the theme store (price, what it has, whether this store owns it). */
export type StoreTheme = {
  key: string;
  name: string;
  short_description: string | null;
  price: { original: number; final: number; discount_percent: number; discount_ends_at: string | null } | null;
  is_free: boolean;
  owned?: boolean;
  can_publish?: boolean;
  cover: Record<string, string> | null;
  features?: string[];
  description?: string | null;
  tags?: Array<{ id: number; slug: string; name: string }>;
  images?: Array<{ id: number; kind: "cover" | "desktop" | "mobile"; urls: Record<string, string> }>;
  min_plan?: { key: string; name: string } | null;
};

export const useStoreTheme = (key: string) => useQuery({ queryKey: ["store", "theme-store", key], queryFn: () => api<StoreTheme>(`/dashboard/theme-store/${encodeURIComponent(key)}`) });

export const useStoreThemes = () => useQuery({ queryKey: ["store", "theme-store"], queryFn: () => api<StoreTheme[]>("/dashboard/theme-store", { query: { kind: "store" } }) });

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

const none = { type: "none" as const, target_id: null, url: null };
const ds = ar.design.builder.types;

/** A new «صوفي» section, ready to edit (the shared types come from newSection). */
export function newSufiSection(type: SufiSectionType): AnySection {
  const id = newId();
  const make = <T extends SufiSectionType>(t: T, props: Extract<SufiSection, { type: T }>["props"]) => ({ id, type: t, visible: true, props }) as SufiSection;
  switch (type) {
    case "hero":
      return make("hero", { slides: [], autoplay: true, height: "full", merge_header: true, shade: 40, kicker: null });
    case "marquee":
      return make("marquee", { items: [d.marqueeItem], speed: "normal" });
    case "categories":
      return make("categories", { title: ds.categories.title, description: null, category_ids: [], shape: "circle", layout: "grid", columns_desktop: 6, columns_mobile: 3 });
    case "product_tabs":
      return make("product_tabs", { title: d.productsTitle, description: null, limit: 8, tabs: [{ label: d.tabLatest, source: "latest", category_id: null, product_ids: [] }] });
    case "banners":
      return make("banners", { items: [] });
    case "countdown":
      return make("countdown", { media_id: null, kicker: null, title: ds.countdown.title, text: null, button_label: null, link: { type: "offers", target_id: null, url: null }, ends_at: new Date(Date.now() + 3 * 86400000).toISOString(), on_end: "hide" });
    case "featured_product":
      return make("featured_product", { product_id: 0, kicker: null });
    case "video":
      return make("video", { url: "", title: null, text: null, cover_media_id: null });
    case "brands":
      return make("brands", { title: ds.brands.title, items: [] });
    case "story":
      return make("story", { kicker: null, title: ds.story.title, text: null, media_id: 0, media2_id: null, stats: [], button_label: null, link: none });
    case "gallery":
      return make("gallery", { title: ds.gallery.title, description: null, items: [] });
    case "faq":
      return make("faq", { title: ds.faq.title, text: null, whatsapp_button: true, items: [{ question: "", answer: "" }] });
    case "location":
      return make("location", { title: ds.location.title, description: null, branches: [{ name: "", address: "", hours: null, phone: null, map_url: "" }] });
    default:
      return newSection(type as SectionType);
  }
}

/** A copy of a section with a new id (its banner images and texts stay the same). */
export function copySection<T extends AnySection>(section: T): T {
  return { ...structuredClone(section), id: newId() };
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
