import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.testimonials;
const c = ar.sections.common;

export type TestimonialItem = {
  name: string;
  subtitle: string;
  text: string;
  rating: number;
  avatar_media_id: number | null;
  proof_media_id: number | null;
};

export type TestimonialsProps = {
  title: string;
  show_rating: boolean;
  items: TestimonialItem[];
};

export const testimonialsSchema: ComponentSchema = {
  type: "testimonials",
  label: t.label,
  description: t.description,
  icon: "message",
  limits: { max: 5 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "show_rating", type: "toggle", label: t.showRating },
    {
      key: "items",
      type: "repeater",
      label: c.items,
      max: 12,
      itemLabel: c.item,
      titleField: "name",
      newItem: { name: "", subtitle: "", text: "", rating: 5, avatar_media_id: null, proof_media_id: null },
      fields: [
        { key: "name", type: "text", label: t.name, max: 60 },
        { key: "subtitle", type: "text", label: t.itemSubtitle, max: 60 },
        { key: "text", type: "textarea", label: c.text, max: 600, rows: 3 },
        { key: "rating", type: "number", label: t.rating, min: 1, max: 5, step: 1 },
        { key: "avatar_media_id", type: "image", label: t.avatar },
        { key: "proof_media_id", type: "image", label: t.proof },
      ],
    },
  ],
  defaults: {
    title: t.defaults.title,
    show_rating: true,
    items: [
      { name: t.defaults.n1, subtitle: t.defaults.c1, text: t.defaults.t1, rating: 5, avatar_media_id: null, proof_media_id: null },
      { name: t.defaults.n2, subtitle: t.defaults.c2, text: t.defaults.t2, rating: 5, avatar_media_id: null, proof_media_id: null },
      { name: t.defaults.n3, subtitle: t.defaults.c3, text: t.defaults.t3, rating: 4, avatar_media_id: null, proof_media_id: null },
    ],
  } satisfies TestimonialsProps,
};
