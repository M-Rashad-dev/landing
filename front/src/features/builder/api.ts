"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ar } from "@/messages/ar";
import type { DesignData } from "@/themes/store/shared/types";
import type { Design, Section, SectionType } from "@/themes/store/asas/types";
import type { RawaqSection, RawaqSectionType, SkinQuizProps } from "@/themes/store/rawaq/types";
import type { ShabeStoreSection, ShabeStoreSectionType } from "@/themes/store/shabe/types";
import type { SufiSection, SufiSectionType } from "@/themes/store/sufi/types";

/** A section of any store theme. */
export type AnySection = Section | SufiSection | ShabeStoreSection | RawaqSection;

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
    case "ai":
      return { id, type: "ai", visible: true, props: { ai_section_id: 0, values: {} } };
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

const sh = ar.design.shabeStore;

/** A new «شابع · متجر» section, ready to edit (library types come from newSufiSection, «أساس»'s from newSection). */
export function newShabeStoreSection(type: ShabeStoreSectionType): AnySection {
  const id = newId();
  const make = <T extends ShabeStoreSectionType>(t: T, props: Extract<ShabeStoreSection, { type: T }>["props"]) => ({ id, type: t, visible: true, props }) as ShabeStoreSection;
  const all = { type: "all_products" as const, target_id: null, url: null };
  switch (type) {
    case "food_hero":
      return make("food_hero", { kicker: null, title: ds.food_hero.title, highlight: null, subtitle: null, media_id: null, stickers: [], badge: null, primary_label: ar.shabeStore.allProducts, primary_link: all, second_label: null, second_link: none, trust: [] });
    case "why":
      return make("why", { kicker: null, title: ds.why.title, subtitle: null, media_id: null, quote: null, items: [{ icon: "chef", title: d.featureTitle, text: null }, { icon: "leaf", title: d.featureTitle, text: null }] });
    case "steps":
      return make("steps", { kicker: null, title: ds.steps.title, items: [{ icon: "utensils", title: d.featureTitle, text: null }, { icon: "bike", title: d.featureTitle, text: null }] });
    case "bundles":
      return make("bundles", { kicker: null, title: ds.bundles.title, subtitle: null, cards: [{ offer_id: 0, media_id: null, title: "", subtitle: null, points: [], ribbon: null, button_label: null }] });
    case "hours":
      return make("hours", { title: ds.hours.title, subtitle: null, days: sh.hours.days.map(() => ({ open: true, from: "12:00", to: "23:00" })), open_message: ar.shabeStore.hours.openNow, closed_message: ar.shabeStore.hours.closedNow });
    case "testimonials":
      return make("testimonials", { title: d.testimonialsTitle, source: "auto", items: [] });
    default:
      return newSufiSection(type as SufiSectionType);
  }
}

const rq = ar.design.rawaq;

/** A new «رواق» section, ready to edit (library types come from newSufiSection, «أساس»'s from newSection). */
export function newRawaqSection(type: RawaqSectionType): AnySection {
  const id = newId();
  const make = <T extends RawaqSectionType>(t: T, props: Extract<RawaqSection, { type: T }>["props"]) => ({ id, type: t, visible: true, props }) as RawaqSection;
  const all = { type: "all_products" as const, target_id: null, url: null };
  switch (type) {
    case "glow_hero":
      return make("glow_hero", { kicker: null, title: ds.glow_hero.title, highlight: null, subtitle: null, media_id: null, badge: null, rating: null, primary_label: ar.rawaqStore.allProducts, primary_link: all, second_label: null, second_link: none, chips: [] });
    case "shortcuts":
      return make("shortcuts", { kicker: null, title: ds.shortcuts.title, description: null, style: "circles", items: [0, 1, 2].map((i) => ({ label: rq.shortcuts.item(i + 1), text: null, media_id: null, color: null, link: all })) });
    case "routine":
      return make("routine", { kicker: null, title: ds.routine.title, text: null, button_label: null, steps: [] });
    case "reels":
      return make("reels", { kicker: null, title: ds.reels.title, items: [] });
    case "ingredients":
      return make("ingredients", { kicker: null, title: ds.ingredients.title, description: null, items: [0, 1].map(() => ({ symbol: "", name: "", text: null, color: null, link: none })) });
    case "cta":
      return make("cta", { title: ds.cta.title, text: null, button_label: ar.rawaqStore.whatsapp, action: "whatsapp", message: null, link: none });
    case "before_after":
      return make("before_after", { kicker: null, title: ds.before_after.title, text: null, before_media_id: null, after_media_id: null, before_label: rq.beforeAfter.beforeWord, after_label: rq.beforeAfter.afterWord, facts: [] });
    case "skin_quiz":
      return make("skin_quiz", starterQuiz());
    case "articles":
      return make("articles", { kicker: null, title: ds.articles.title, items: rq.articles.starter.map((title) => ({ media_id: null, tag: null, title, body: null, link: none })) });
    case "testimonials":
      return make("testimonials", { title: d.testimonialsTitle, source: "auto", items: [] });
    default:
      return newSufiSection(type as SufiSectionType);
  }
}

/** The ready quiz a new «اختبار البشرة» starts with (results and products are the merchant's to adjust). */
export function starterQuiz(): SkinQuizProps {
  const s = rq.quiz.starter;
  return {
    kicker: s.kicker,
    title: s.title,
    text: s.text,
    button_label: null,
    results: s.results.map((x) => ({ ...x, product_ids: [], category_id: null })),
    questions: s.questions.map((q) => ({ text: q.text, answers: q.answers.map(([text, ...results]) => ({ text, results })) })),
  };
}

/** How many visitors finished each quiz, per result (last 30 days). */
export type QuizStats = { section_id: string; title: string; total: number; results: Array<{ id: string; name: string; count: number }> };
export const useQuizResults = () => useQuery({ queryKey: ["store", "design", "quiz-results"], queryFn: () => api<QuizStats[]>("/dashboard/store/design/quiz-results") });

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
