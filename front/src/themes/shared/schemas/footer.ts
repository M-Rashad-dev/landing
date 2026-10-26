import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.footer;
const c = ar.sections.common;

export type FooterProps = {
  brand_text: string;
  about: string;
  links: { label: string; link_url: string }[];
  show_socials: boolean;
  show_contact: boolean;
  copyright_text: string;
  show_platform_credit: boolean;
};

export const footerSchema: ComponentSchema = {
  type: "footer",
  label: t.label,
  description: t.description,
  icon: "globe",
  limits: { max: 1, singleton: true, pinned: "bottom" },
  fields: [
    { key: "brand_text", type: "text", label: ar.sections.header.brandText, hint: ar.sections.header.brandTextHint, max: 60 },
    { key: "about", type: "textarea", label: t.about, max: 500, rows: 3 },
    {
      key: "links",
      type: "repeater",
      label: c.items,
      max: 8,
      itemLabel: c.link,
      titleField: "label",
      newItem: { label: "", link_url: "" },
      fields: [
        { key: "label", type: "text", label: c.label, max: 30 },
        { key: "link_url", type: "link", label: c.link },
      ],
    },
    { key: "show_socials", type: "toggle", label: t.showSocials },
    { key: "show_contact", type: "toggle", label: t.showContact },
    { key: "copyright_text", type: "text", label: t.copyright, max: 120 },
    { key: "show_platform_credit", type: "toggle", label: t.showCredit },
  ],
  defaults: {
    brand_text: "",
    about: t.defaults.about,
    links: [],
    show_socials: true,
    show_contact: true,
    copyright_text: t.defaults.copyright,
    show_platform_credit: false,
  } satisfies FooterProps,
};
