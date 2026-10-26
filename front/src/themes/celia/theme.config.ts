import { FALLBACK_COMPONENTS } from "@/themes/_fallback";
import type { ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";

/** «سيليا» — bold and modern. Components are implemented in phase 7; placeholders until then. */
export const celiaTheme: ThemeDef = {
  key: "celia",
  name: ar.themes.celia.name,
  description: ar.themes.celia.description,
  components: {
    header: { ...FALLBACK_COMPONENTS.header, variants: [{ key: "bar", label: ar.themes.variants.bar }, { key: "minimal", label: ar.themes.variants.minimal }], defaultVariant: "bar" },
    hero: { ...FALLBACK_COMPONENTS.hero, variants: [{ key: "big-type", label: ar.themes.variants["big-type"] }, { key: "split-reverse", label: ar.themes.variants["split-reverse"] }, { key: "full-cover", label: ar.themes.variants["full-cover"] }], defaultVariant: "big-type" },
    gallery: { ...FALLBACK_COMPONENTS.gallery, variants: [{ key: "thumbs-side", label: ar.themes.variants["thumbs-side"] }, { key: "masonry", label: ar.themes.variants.masonry }], defaultVariant: "thumbs-side" },
    product_showcase: { ...FALLBACK_COMPONENTS.product_showcase, variants: [{ key: "split-image", label: ar.themes.variants["split-image"] }, { key: "stacked", label: ar.themes.variants.stacked }], defaultVariant: "split-image" },
    features: { ...FALLBACK_COMPONENTS.features, variants: [{ key: "numbered-grid", label: ar.themes.variants["numbered-grid"] }, { key: "icon-list", label: ar.themes.variants["icon-list"] }], defaultVariant: "numbered-grid" },
    offers: { ...FALLBACK_COMPONENTS.offers, variants: [{ key: "bundle-tiles", label: ar.themes.variants["bundle-tiles"] }, { key: "countdown-strip", label: ar.themes.variants["countdown-strip"] }], defaultVariant: "bundle-tiles" },
    testimonials: { ...FALLBACK_COMPONENTS.testimonials, variants: [{ key: "quote-wall", label: ar.themes.variants["quote-wall"] }, { key: "screenshots-grid", label: ar.themes.variants["screenshots-grid"] }], defaultVariant: "quote-wall" },
    faq: { ...FALLBACK_COMPONENTS.faq, variants: [{ key: "accordion-lines", label: ar.themes.variants["accordion-lines"] }, { key: "numbered", label: ar.themes.variants.numbered }], defaultVariant: "accordion-lines" },
    order_form: { ...FALLBACK_COMPONENTS.order_form, variants: [{ key: "bordered", label: ar.themes.variants.bordered }, { key: "sticky-summary", label: ar.themes.variants["sticky-summary"] }], defaultVariant: "bordered" },
    footer: { ...FALLBACK_COMPONENTS.footer, variants: [{ key: "dark-columns", label: ar.themes.variants["dark-columns"] }, { key: "minimal-line", label: ar.themes.variants["minimal-line"] }], defaultVariant: "dark-columns" },
  },
  starterSections: [
    { type: "header", variant: "bar" },
    { type: "hero", variant: "big-type" },
    { type: "gallery", variant: "thumbs-side" },
    { type: "product_showcase", variant: "split-image" },
    { type: "features", variant: "numbered-grid" },
    { type: "offers", variant: "bundle-tiles" },
    { type: "testimonials", variant: "quote-wall" },
    { type: "faq", variant: "accordion-lines" },
    { type: "order_form", variant: "bordered" },
    { type: "footer", variant: "dark-columns" },
  ],
};
