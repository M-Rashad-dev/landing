import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.header;
const c = ar.sections.common;

export type HeaderProps = {
  show_logo: boolean;
  logo_media_id: number | null;
  brand_text: string;
  links: { label: string; link_url: string }[];
  cta_enabled: boolean;
  cta_label: string;
  cta_url: string;
  sticky: boolean;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_color: string;
};

export const headerSchema: ComponentSchema = {
  type: "header",
  label: t.label,
  description: t.description,
  icon: "home",
  limits: { max: 1, singleton: true, pinned: "top" },
  fields: [
    { key: "show_logo", type: "toggle", label: t.showLogo },
    { key: "logo_media_id", type: "image", label: t.logo, hint: t.logoHint, showIf: { field: "show_logo", equals: true } },
    { key: "brand_text", type: "text", label: t.brandText, hint: t.brandTextHint, max: 60 },
    {
      key: "links",
      type: "repeater",
      label: t.links,
      max: 5,
      itemLabel: c.link,
      titleField: "label",
      newItem: { label: "", link_url: "" },
      fields: [
        { key: "label", type: "text", label: c.label, max: 30 },
        { key: "link_url", type: "link", label: c.link },
      ],
    },
    { key: "cta_enabled", type: "toggle", label: t.ctaEnabled },
    { key: "cta_label", type: "text", label: c.ctaLabel, max: 30, showIf: { field: "cta_enabled", equals: true } },
    { key: "cta_url", type: "link", label: c.ctaUrl, showIf: { field: "cta_enabled", equals: true } },
    { key: "sticky", type: "toggle", label: t.sticky },
    { key: "announcement_enabled", type: "toggle", label: t.announcementEnabled },
    { key: "announcement_text", type: "text", label: t.announcementText, max: 120, showIf: { field: "announcement_enabled", equals: true } },
    { key: "announcement_color", type: "color", label: t.announcementColor, showIf: { field: "announcement_enabled", equals: true } },
  ],
  defaults: {
    show_logo: true,
    logo_media_id: null,
    brand_text: "",
    links: [
      { label: t.defaults.link1, link_url: "" },
      { label: t.defaults.link2, link_url: "" },
      { label: t.defaults.link3, link_url: "" },
    ],
    cta_enabled: true,
    cta_label: t.defaults.cta,
    cta_url: "#order",
    sticky: true,
    announcement_enabled: false,
    announcement_text: t.defaults.announcement,
    announcement_color: "",
  } satisfies HeaderProps,
};
