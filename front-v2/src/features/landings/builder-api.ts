"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ar } from "@/messages/ar";
import type { ProductOffer, ShippingConfig, StoreProduct } from "@/lib/store/types";
import type { Content, LandingData, PageImage, Section, SectionType } from "@/themes/bidaya/types";

/** GET /dashboard/pages/{id} (PageDetailResource). */
export type PageDetail = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  theme_key: string;
  identity_id: number;
  product_id: number | null;
  has_unpublished_changes: boolean;
  published_at: string | null;
  draft_content: Content;
  version: number;
  seo_override: { title?: string | null; description?: string | null; og_media_id?: number | null; noindex?: boolean } | null;
};

/** GET /dashboard/pages/{id}/preview: what the page shows besides its content. */
export type PreviewData = {
  page: { id: number; slug: string; title: string };
  product: StoreProduct | null;
  offers: ProductOffer[];
  media: Record<string, PageImage>;
  shipping: ShippingConfig;
  reviews: LandingData["reviews"];
  store_name: string;
};

export const pageKey = (id: number) => ["landings", "page", id] as const;

export function useLandingEditor(id: number) {
  const page = useQuery({ queryKey: pageKey(id), queryFn: () => api<PageDetail>(`/dashboard/pages/${id}`), refetchOnWindowFocus: false });
  const preview = useQuery({ queryKey: ["landings", "preview", id], queryFn: () => api<PreviewData>(`/dashboard/pages/${id}/preview`), refetchOnWindowFocus: false });
  return { page, preview };
}

export const saveLandingContent = (id: number, content: Content, version: number) => api<PageDetail>(`/dashboard/pages/${id}/content`, { method: "PUT", body: { version, content } });
export const publishLandingPage = (id: number) => api<PageDetail>(`/dashboard/pages/${id}/publish`, { method: "POST" });
export const saveLandingSettings = (id: number, body: { title: string; slug: string; identity_id: number; product_id: number | null; seo_override: PageDetail["seo_override"] }) =>
  api<PageDetail>(`/dashboard/pages/${id}`, { method: "PUT", body });

export function toLandingData(preview: PreviewData): LandingData {
  return { page: preview.page, store_name: preview.store_name, product: preview.product, offers: preview.offers, media: preview.media, reviews: preview.reviews, shipping: preview.shipping };
}

/** Section ids like the back end makes them (12 hex characters). */
export function newId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ADDABLE: SectionType[] = ["hero", "features", "gallery", "testimonials", "faq"];

const d = ar.landings.builder;

/** A new section of a type, ready to edit. */
export function newLandingSection(type: Exclude<SectionType, "order_form">, productName: string | null): Section {
  const id = newId();
  switch (type) {
    case "hero":
      return { id, type, visible: true, props: { title: productName ?? d.types.hero.title, subtitle: null, image_media_id: null, show_price: true, button_label: ar.bidaya.orderNow, badge: null } };
    case "features":
      return {
        id,
        type,
        visible: true,
        props: {
          title: null,
          items: [
            { icon: "truck", title: ar.design.builder.defaults.featureTitle, text: null },
            { icon: "cash", title: ar.design.builder.defaults.featureTitle, text: null },
          ],
        },
      };
    case "gallery":
      return { id, type, visible: true, props: { title: d.types.gallery.title, image_media_ids: [] } };
    case "testimonials":
      return { id, type, visible: true, props: { title: d.types.testimonials.title, source: "auto", items: [] } };
    case "faq":
      return { id, type, visible: true, props: { title: d.types.faq.title, items: [{ question: d.faq.question, answer: d.faq.answer }] } };
  }
}

/** Errors of one section from the server keys (content.sections.{i}.props.…), by the rest of the path. */
export function sectionErrors(errors: Record<string, string>, index: number): Record<string, string> {
  const prefix = `content.sections.${index}.props.`;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
  return out;
}

export function settingsErrors(errors: Record<string, string>): Record<string, string> {
  const prefix = "content.settings.";
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
  return out;
}
