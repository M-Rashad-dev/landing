import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.before_after;
const c = ar.sections.common;

export type BeforeAfterProps = {
  title: string;
  subtitle: string;
  before_media_id: number | null;
  after_media_id: number | null;
  before_label: string;
  after_label: string;
};

export const beforeAfterSchema: ComponentSchema = {
  type: "before_after",
  label: t.label,
  description: t.description,
  icon: "contrast",
  limits: { max: 5 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "before_media_id", type: "image", label: t.before },
    { key: "after_media_id", type: "image", label: t.after },
    { key: "before_label", type: "text", label: t.beforeLabel, max: 30 },
    { key: "after_label", type: "text", label: t.afterLabel, max: 30 },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    before_media_id: null,
    after_media_id: null,
    before_label: t.defaults.before,
    after_label: t.defaults.after,
  } satisfies BeforeAfterProps,
};
