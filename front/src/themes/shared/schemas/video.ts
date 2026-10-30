import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.video;
const c = ar.sections.common;

export type VideoProps = {
  title: string;
  subtitle: string;
  video_url: string;
  poster_media_id: number | null;
  cta_label: string;
};

export const videoSchema: ComponentSchema = {
  type: "video",
  label: t.label,
  description: t.description,
  icon: "play",
  limits: { max: 5 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "video_url", type: "text", label: t.url, hint: t.urlHint, max: 500, placeholder: "https://youtu.be/..." },
    { key: "poster_media_id", type: "image", label: t.poster, hint: t.posterHint },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 60 },
  ],
  defaults: { title: t.defaults.title, subtitle: t.defaults.subtitle, video_url: "", poster_media_id: null, cta_label: t.defaults.cta } satisfies VideoProps,
};
