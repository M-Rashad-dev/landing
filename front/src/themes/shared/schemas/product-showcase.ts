import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.product_showcase;
const c = ar.sections.common;

export type ProductShowcaseProps = {
  title_override: string;
  show_description: boolean;
  description_override: string;
  show_price: boolean;
  show_compare_price: boolean;
  show_discount_badge: boolean;
  highlights: { icon: string; text: string }[];
  cta_label: string;
  cta_url: string;
};

export const productShowcaseSchema: ComponentSchema = {
  type: "product_showcase",
  label: t.label,
  description: t.description,
  icon: "package",
  limits: { max: 5 },
  fields: [
    { key: "title_override", type: "text", label: t.titleOverride, hint: t.titleOverrideHint, max: 120 },
    { key: "show_description", type: "toggle", label: t.showDescription },
    { key: "description_override", type: "textarea", label: t.descriptionOverride, hint: t.descriptionOverrideHint, max: 2000, rows: 4, showIf: { field: "show_description", equals: true } },
    { key: "show_price", type: "toggle", label: t.showPrice },
    { key: "show_compare_price", type: "toggle", label: t.showComparePrice, showIf: { field: "show_price", equals: true } },
    { key: "show_discount_badge", type: "toggle", label: t.showDiscountBadge, showIf: { field: "show_price", equals: true } },
    {
      key: "highlights",
      type: "repeater",
      label: t.highlights,
      max: 6,
      itemLabel: c.text,
      titleField: "text",
      newItem: { icon: "badge_check", text: "" },
      fields: [
        { key: "icon", type: "icon", label: c.icon },
        { key: "text", type: "text", label: c.text, max: 80 },
      ],
    },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 30 },
    { key: "cta_url", type: "link", label: c.ctaUrl },
  ],
  defaults: {
    title_override: "",
    show_description: true,
    description_override: "",
    show_price: true,
    show_compare_price: true,
    show_discount_badge: true,
    highlights: [
      { icon: "badge_check", text: t.defaults.h1 },
      { icon: "ruler", text: t.defaults.h2 },
      { icon: "gift", text: t.defaults.h3 },
    ],
    cta_label: t.defaults.cta,
    cta_url: "#order",
  } satisfies ProductShowcaseProps,
};
