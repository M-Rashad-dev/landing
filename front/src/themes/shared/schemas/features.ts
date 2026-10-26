import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.features;
const c = ar.sections.common;

export type FeatureItem = { icon: string; title: string; description: string; image_media_id: number | null };

export type FeaturesProps = {
  title: string;
  subtitle: string;
  columns: "2" | "3" | "4";
  items: FeatureItem[];
};

export const featuresSchema: ComponentSchema = {
  type: "features",
  label: t.label,
  description: t.description,
  icon: "award",
  limits: { max: 10 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    {
      key: "columns",
      type: "select",
      label: t.columns,
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
    {
      key: "items",
      type: "repeater",
      label: c.items,
      min: 2,
      max: 8,
      itemLabel: c.item,
      titleField: "title",
      newItem: { icon: "star", title: "", description: "", image_media_id: null },
      fields: [
        { key: "icon", type: "icon", label: c.icon },
        { key: "title", type: "text", label: c.title, max: 80 },
        { key: "description", type: "textarea", label: c.description, max: 300, rows: 2 },
        { key: "image_media_id", type: "image", label: t.itemImage },
      ],
    },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    columns: "3",
    items: [
      { icon: "truck", title: t.defaults.f1, description: t.defaults.f1d, image_media_id: null },
      { icon: "wallet", title: t.defaults.f2, description: t.defaults.f2d, image_media_id: null },
      { icon: "refresh", title: t.defaults.f3, description: t.defaults.f3d, image_media_id: null },
    ],
  } satisfies FeaturesProps,
};
