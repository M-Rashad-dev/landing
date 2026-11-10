import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const c = ar.sections.common;

/* ---------- banner_slider ---------- */

const tb = ar.sections.banner_slider;

export type BannerSlide = {
  image_media_id: number | null;
  mobile_image_media_id: number | null;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
};

export type BannerSliderProps = {
  slides: BannerSlide[];
  height: "small" | "medium" | "large";
  autoplay: boolean;
};

export const bannerSliderSchema: ComponentSchema = {
  type: "banner_slider",
  label: tb.label,
  description: tb.description,
  icon: "sparkles",
  limits: { max: 2 },
  fields: [
    {
      key: "slides",
      type: "repeater",
      label: tb.slides,
      itemLabel: tb.slide,
      titleField: "title",
      min: 1,
      max: 6,
      newItem: { image_media_id: null, mobile_image_media_id: null, title: "", subtitle: "", cta_label: "", cta_url: "/products" },
      fields: [
        { key: "image_media_id", type: "image", label: tb.image, hint: tb.imageHint },
        { key: "mobile_image_media_id", type: "image", label: tb.mobileImage, hint: tb.mobileImageHint },
        { key: "title", type: "text", label: c.title, max: 120 },
        { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
        { key: "cta_label", type: "text", label: c.ctaLabel, max: 60 },
        { key: "cta_url", type: "link", label: c.ctaUrl },
      ],
    },
    {
      key: "height",
      type: "select",
      label: tb.height,
      options: (["small", "medium", "large"] as const).map((value) => ({ value, label: tb.heights[value] })),
    },
    { key: "autoplay", type: "toggle", label: tb.autoplay },
  ],
  defaults: {
    slides: [{ image_media_id: null, mobile_image_media_id: null, title: tb.defaults.title, subtitle: tb.defaults.subtitle, cta_label: tb.defaults.cta, cta_url: "/products" }],
    height: "medium",
    autoplay: true,
  } satisfies BannerSliderProps,
};

/* ---------- category_grid ---------- */

const tc = ar.sections.category_grid;

export type CategoryGridProps = {
  title: string;
  subtitle: string;
  source: "top" | "children";
  parent_id: number | null;
  limit: number;
  show_count: boolean;
};

export const categoryGridSchema: ComponentSchema = {
  type: "category_grid",
  label: tc.label,
  description: tc.description,
  icon: "box",
  limits: { max: 3 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    {
      key: "source",
      type: "select",
      label: tc.source,
      options: [
        { value: "top", label: tc.sourceTop },
        { value: "children", label: tc.sourceChildren },
      ],
    },
    { key: "parent_id", type: "category", label: tc.parent, showIf: { field: "source", equals: "children" } },
    { key: "limit", type: "number", label: tc.limit, min: 2, max: 24 },
    { key: "show_count", type: "toggle", label: tc.showCount },
  ],
  defaults: { title: tc.defaults.title, subtitle: tc.defaults.subtitle, source: "top", parent_id: null, limit: 8, show_count: true } satisfies CategoryGridProps,
};

/* ---------- product_grid ---------- */

const tp = ar.sections.product_grid;

export type ProductGridSource = "newest" | "featured" | "best_sellers" | "category";

export type ProductGridProps = {
  title: string;
  subtitle: string;
  source: ProductGridSource;
  category_id: number | null;
  limit: number;
  show_view_all: boolean;
  view_all_label: string;
};

export const productGridSchema: ComponentSchema = {
  type: "product_grid",
  label: tp.label,
  description: tp.description,
  icon: "shopping_bag",
  limits: { max: 6 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    {
      key: "source",
      type: "select",
      label: tp.source,
      options: (["newest", "featured", "best_sellers", "category"] as const).map((value) => ({ value, label: tp.sources[value] })),
    },
    { key: "category_id", type: "category", label: tp.category, showIf: { field: "source", equals: "category" } },
    { key: "limit", type: "number", label: tp.limit, min: 1, max: 24 },
    { key: "show_view_all", type: "toggle", label: tp.showViewAll },
    { key: "view_all_label", type: "text", label: tp.viewAll, max: 40, showIf: { field: "show_view_all", equals: true } },
  ],
  defaults: {
    title: tp.defaults.title,
    subtitle: tp.defaults.subtitle,
    source: "newest",
    category_id: null,
    limit: 8,
    show_view_all: true,
    view_all_label: tp.defaults.viewAll,
  } satisfies ProductGridProps,
};

/* ---------- promo_banner ---------- */

const tr = ar.sections.promo_banner;

export type PromoBannerProps = {
  image_media_id: number | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
  align: "start" | "center";
  overlay: number;
};

export const promoBannerSchema: ComponentSchema = {
  type: "promo_banner",
  label: tr.label,
  description: tr.description,
  icon: "gift",
  limits: { max: 5 },
  fields: [
    { key: "image_media_id", type: "image", label: tr.image },
    { key: "eyebrow", type: "text", label: c.eyebrow, max: 60 },
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 60 },
    { key: "cta_url", type: "link", label: c.ctaUrl },
    {
      key: "align",
      type: "select",
      label: tr.align,
      options: (["start", "center"] as const).map((value) => ({ value, label: tr.aligns[value] })),
    },
    { key: "overlay", type: "range", label: tr.overlay, min: 0, max: 80, step: 5, unit: "%" },
  ],
  defaults: {
    image_media_id: null,
    eyebrow: tr.defaults.eyebrow,
    title: tr.defaults.title,
    subtitle: tr.defaults.subtitle,
    cta_label: tr.defaults.cta,
    cta_url: "/products",
    align: "start",
    overlay: 40,
  } satisfies PromoBannerProps,
};
