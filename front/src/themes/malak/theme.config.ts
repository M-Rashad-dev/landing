import { FALLBACK_COMPONENTS } from "@/themes/_fallback";
import type { ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";

/** «ملاك» — soft and calm. Components are implemented in phase 6; placeholders until then. */
export const malakTheme: ThemeDef = {
  key: "malak",
  name: ar.themes.malak.name,
  description: ar.themes.malak.description,
  components: {
    header: { ...FALLBACK_COMPONENTS.header, variants: [{ key: "centered-logo", label: ar.themes.variants["centered-logo"] }, { key: "logo-start", label: ar.themes.variants["logo-start"] }], defaultVariant: "centered-logo" },
    hero: { ...FALLBACK_COMPONENTS.hero, variants: [{ key: "split", label: ar.themes.variants.split }, { key: "full-cover", label: ar.themes.variants["full-cover"] }, { key: "centered-card", label: ar.themes.variants["centered-card"] }], defaultVariant: "split" },
    gallery: { ...FALLBACK_COMPONENTS.gallery, variants: [{ key: "slider", label: ar.themes.variants.slider }, { key: "grid", label: ar.themes.variants.grid }], defaultVariant: "slider" },
    product_showcase: { ...FALLBACK_COMPONENTS.product_showcase, variants: [{ key: "card", label: ar.themes.variants.card }, { key: "side-by-side", label: ar.themes.variants["side-by-side"] }], defaultVariant: "card" },
    features: { ...FALLBACK_COMPONENTS.features, variants: [{ key: "icon-cards", label: ar.themes.variants["icon-cards"] }, { key: "alternating", label: ar.themes.variants.alternating }], defaultVariant: "icon-cards" },
    offers: { ...FALLBACK_COMPONENTS.offers, variants: [{ key: "cards", label: ar.themes.variants.cards }, { key: "ribbon-banner", label: ar.themes.variants["ribbon-banner"] }], defaultVariant: "cards" },
    testimonials: { ...FALLBACK_COMPONENTS.testimonials, variants: [{ key: "cards-slider", label: ar.themes.variants["cards-slider"] }, { key: "grid", label: ar.themes.variants.grid }], defaultVariant: "cards-slider" },
    faq: { ...FALLBACK_COMPONENTS.faq, variants: [{ key: "accordion-soft", label: ar.themes.variants["accordion-soft"] }, { key: "two-columns", label: ar.themes.variants["two-columns"] }], defaultVariant: "accordion-soft" },
    order_form: { ...FALLBACK_COMPONENTS.order_form, variants: [{ key: "card", label: ar.themes.variants.card }, { key: "split-summary", label: ar.themes.variants["split-summary"] }], defaultVariant: "card" },
    footer: { ...FALLBACK_COMPONENTS.footer, variants: [{ key: "simple-center", label: ar.themes.variants["simple-center"] }, { key: "columns", label: ar.themes.variants.columns }], defaultVariant: "simple-center" },
  },
  starterSections: [
    { type: "header", variant: "centered-logo" },
    { type: "hero", variant: "split" },
    { type: "gallery", variant: "slider" },
    { type: "product_showcase", variant: "card" },
    { type: "features", variant: "icon-cards" },
    { type: "offers", variant: "cards" },
    { type: "testimonials", variant: "cards-slider" },
    { type: "faq", variant: "accordion-soft" },
    { type: "order_form", variant: "card" },
    { type: "footer", variant: "simple-center" },
  ],
};
