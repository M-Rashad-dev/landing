import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.comparison;
const c = ar.sections.common;

export type ComparisonRow = { feature: string; us: boolean; them: boolean };

export type ComparisonProps = {
  title: string;
  subtitle: string;
  us_label: string;
  them_label: string;
  rows: ComparisonRow[];
};

export const comparisonSchema: ComponentSchema = {
  type: "comparison",
  label: t.label,
  description: t.description,
  icon: "scale",
  limits: { max: 3 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "us_label", type: "text", label: t.usLabel, max: 40 },
    { key: "them_label", type: "text", label: t.themLabel, max: 40 },
    {
      key: "rows",
      type: "repeater",
      label: t.rows,
      max: 12,
      itemLabel: t.feature,
      titleField: "feature",
      newItem: { feature: "", us: true, them: false },
      fields: [
        { key: "feature", type: "text", label: t.feature, max: 120 },
        { key: "us", type: "toggle", label: t.us },
        { key: "them", type: "toggle", label: t.them },
      ],
    },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    us_label: t.defaults.us,
    them_label: t.defaults.them,
    rows: [
      { feature: t.defaults.f1, us: true, them: false },
      { feature: t.defaults.f2, us: true, them: true },
      { feature: t.defaults.f3, us: true, them: false },
      { feature: t.defaults.f4, us: true, them: false },
    ],
  } satisfies ComparisonProps,
};
