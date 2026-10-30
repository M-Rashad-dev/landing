import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.sticky_cta;
const c = ar.sections.common;

export type StickyCtaProps = {
  cta_label: string;
  show_price: boolean;
  show_on_desktop: boolean;
};

export const stickyCtaSchema: ComponentSchema = {
  type: "sticky_cta",
  label: t.label,
  description: t.description,
  icon: "pointer",
  limits: { max: 1 },
  fields: [
    { key: "cta_label", type: "text", label: c.ctaLabel, hint: t.hint, max: 60 },
    { key: "show_price", type: "toggle", label: t.showPrice },
    { key: "show_on_desktop", type: "toggle", label: t.desktop },
  ],
  defaults: { cta_label: t.defaults.cta, show_price: true, show_on_desktop: false } satisfies StickyCtaProps,
};
