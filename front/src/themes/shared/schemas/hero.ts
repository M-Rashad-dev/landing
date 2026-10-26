import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.hero;
const c = ar.sections.common;

export type HeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  image_media_id: number | null;
  mobile_image_media_id: number | null;
  cta_label: string;
  cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
  show_price: boolean;
  badges: { text: string }[];
  text_align: "start" | "center";
  overlay_opacity: number;
  min_height: "sm" | "md" | "lg" | "screen";
};

export const heroSchema: ComponentSchema = {
  type: "hero",
  label: t.label,
  description: t.description,
  icon: "sparkles",
  limits: { max: 5 },
  fields: [
    { key: "eyebrow", type: "text", label: t.eyebrow, max: 60 },
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 3 },
    { key: "image_media_id", type: "image", label: c.image },
    { key: "mobile_image_media_id", type: "image", label: t.mobileImage, hint: t.mobileImageHint },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 30 },
    { key: "cta_url", type: "link", label: c.ctaUrl },
    { key: "secondary_cta_label", type: "text", label: t.secondaryCtaLabel, max: 30 },
    { key: "secondary_cta_url", type: "link", label: t.secondaryCtaUrl },
    { key: "show_price", type: "toggle", label: t.showPrice },
    {
      key: "badges",
      type: "repeater",
      label: t.badges,
      max: 4,
      itemLabel: c.text,
      titleField: "text",
      newItem: { text: "" },
      fields: [{ key: "text", type: "text", label: c.text, max: 40 }],
    },
    {
      key: "text_align",
      type: "select",
      label: t.textAlign,
      options: [
        { value: "start", label: t.alignStart },
        { value: "center", label: t.alignCenter },
      ],
    },
    { key: "overlay_opacity", type: "range", label: t.overlay, min: 0, max: 80, step: 5, unit: "%" },
    {
      key: "min_height",
      type: "select",
      label: t.minHeight,
      options: (["sm", "md", "lg", "screen"] as const).map((value) => ({ value, label: t.heights[value] })),
    },
  ],
  defaults: {
    eyebrow: t.defaults.eyebrow,
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    image_media_id: null,
    mobile_image_media_id: null,
    cta_label: t.defaults.cta,
    cta_url: "#order",
    secondary_cta_label: t.defaults.secondary,
    secondary_cta_url: "",
    show_price: true,
    badges: [{ text: t.defaults.badge1 }, { text: t.defaults.badge2 }, { text: t.defaults.badge3 }],
    text_align: "start",
    overlay_opacity: 40,
    min_height: "md",
  } satisfies HeroProps,
};
