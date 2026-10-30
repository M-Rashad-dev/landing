import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.countdown;
const c = ar.sections.common;

export type CountdownProps = {
  title: string;
  subtitle: string;
  mode: "fixed" | "evergreen";
  /** Cairo wall time "YYYY-MM-DDTHH:mm". */
  ends_at: string;
  minutes: number;
  expired_text: string;
  show_cta: boolean;
  cta_label: string;
};

export const countdownSchema: ComponentSchema = {
  type: "countdown",
  label: t.label,
  description: t.description,
  icon: "timer",
  limits: { max: 3 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    {
      key: "mode",
      type: "select",
      label: t.mode,
      options: [
        { value: "evergreen", label: t.modes.evergreen },
        { value: "fixed", label: t.modes.fixed },
      ],
    },
    { key: "ends_at", type: "datetime", label: t.endsAt, showIf: { field: "mode", equals: "fixed" } },
    { key: "minutes", type: "number", label: t.minutes, hint: t.minutesHint, min: 5, max: 10080, step: 5, showIf: { field: "mode", equals: "evergreen" } },
    { key: "expired_text", type: "text", label: t.expired, max: 160 },
    { key: "show_cta", type: "toggle", label: t.showCta },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 60, showIf: { field: "show_cta", equals: true } },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    mode: "evergreen",
    ends_at: "",
    minutes: 120,
    expired_text: t.defaults.expired,
    show_cta: true,
    cta_label: t.defaults.cta,
  } satisfies CountdownProps,
};
