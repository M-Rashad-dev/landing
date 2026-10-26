import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.gallery;
const c = ar.sections.common;

export type GalleryProps = {
  title: string;
  source: "product" | "custom";
  image_media_ids: number[];
  autoplay: boolean;
  show_thumbnails: boolean;
  lightbox: boolean;
};

export const gallerySchema: ComponentSchema = {
  type: "gallery",
  label: t.label,
  description: t.description,
  icon: "sun",
  limits: { max: 5 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    {
      key: "source",
      type: "select",
      label: t.source,
      options: [
        { value: "product", label: t.sourceProduct },
        { value: "custom", label: t.sourceCustom },
      ],
    },
    { key: "image_media_ids", type: "images", label: t.images, max: 12, showIf: { field: "source", equals: "custom" } },
    { key: "autoplay", type: "toggle", label: t.autoplay },
    { key: "show_thumbnails", type: "toggle", label: t.showThumbnails },
    { key: "lightbox", type: "toggle", label: t.lightbox },
  ],
  defaults: {
    title: t.defaults.title,
    source: "product",
    image_media_ids: [],
    autoplay: false,
    show_thumbnails: true,
    lightbox: true,
  } satisfies GalleryProps,
};
