import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.offers;
const c = ar.sections.common;

export type OffersProps = {
  title: string;
  subtitle: string;
  show_countdown: boolean;
  show_savings: boolean;
  empty_behavior: "hide" | "message";
  empty_message: string;
  cta_label: string;
};

export const offersSchema: ComponentSchema = {
  type: "offers",
  label: t.label,
  description: t.description,
  icon: "flame",
  limits: { max: 5 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "show_countdown", type: "toggle", label: t.showCountdown },
    { key: "show_savings", type: "toggle", label: t.showSavings },
    {
      key: "empty_behavior",
      type: "select",
      label: t.emptyBehavior,
      options: [
        { value: "hide", label: t.emptyHide },
        { value: "message", label: t.emptyMessage },
      ],
    },
    { key: "empty_message", type: "text", label: t.emptyMessageText, max: 160, showIf: { field: "empty_behavior", equals: "message" } },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 30 },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    show_countdown: true,
    show_savings: true,
    empty_behavior: "hide",
    empty_message: t.defaults.empty,
    cta_label: t.defaults.cta,
  } satisfies OffersProps,
};
