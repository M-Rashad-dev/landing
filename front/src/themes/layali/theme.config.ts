import type { ThemeComponentDef, ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";
import { storeSectionDefs } from "@/themes/shared/store/register";
import { LayaliBeforeAfter, LayaliComparison, LayaliCountdown, LayaliSizeChart, LayaliStickyCta, LayaliVideo } from "./components/blocks";
import { LayaliFaq } from "./components/faq";
import { LayaliFeatures } from "./components/features";
import { LayaliFooter } from "./components/footer";
import { LayaliGallery } from "./components/gallery";
import { LayaliHeader } from "./components/header";
import { LayaliHero } from "./components/hero";
import { LayaliOffers } from "./components/offers";
import { LayaliOrderForm } from "./components/order-form";
import { LayaliProductShowcase } from "./components/product-showcase";
import { LayaliTestimonials } from "./components/testimonials";
import { LayaliThumbs } from "./thumbnails";

const v = (keys: string[]) => keys.map((key) => ({ key, label: ar.themes.variants[key] ?? key }));

function def(type: keyof typeof LayaliThumbs, component: ThemeComponentDef["component"], variants: string[]): ThemeComponentDef {
  return { component, variants: v(variants), defaultVariant: variants[0], Thumbnail: LayaliThumbs[type] };
}

/**
 * «ليالي» — night luxury: a dark page made from the store's own colors (themes/color-mode.ts),
 * glass surfaces, gradient headlines and soft glows in the primary and accent colors.
 */
export const layaliTheme: ThemeDef = {
  key: "layali",
  kind: "landing",
  name: ar.themes.layali.name,
  description: ar.themes.layali.description,
  components: {
    header: def("header", LayaliHeader, ["glass-bar", "centered-minimal"]),
    hero: def("hero", LayaliHero, ["glow-center", "split-glass"]),
    gallery: def("gallery", LayaliGallery, ["spotlight", "glass-grid"]),
    product_showcase: def("product_showcase", LayaliProductShowcase, ["luxe-split", "center-stage"]),
    features: def("features", LayaliFeatures, ["glass-cards", "glow-timeline"]),
    offers: def("offers", LayaliOffers, ["glow-cards", "spotlight"]),
    testimonials: def("testimonials", LayaliTestimonials, ["glass-slider", "quote-masonry"]),
    faq: def("faq", LayaliFaq, ["glass-accordion", "split-glow"]),
    order_form: def("order_form", LayaliOrderForm, ["glass-card", "split-luxe"]),
    footer: def("footer", LayaliFooter, ["glow-columns", "signature"]),
    video: def("video", LayaliVideo, ["framed", "video-split"]),
    before_after: def("before_after", LayaliBeforeAfter, ["drag-slider", "two-images"]),
    size_chart: def("size_chart", LayaliSizeChart, ["table", "size-cards"]),
    comparison: def("comparison", LayaliComparison, ["versus-cards", "check-table"]),
    countdown: def("countdown", LayaliCountdown, ["boxes", "banner"]),
    sticky_cta: def("sticky_cta", LayaliStickyCta, ["pill", "full-bar"]),
    ...storeSectionDefs("layali"),
  },
  starterSections: [
    { type: "header", variant: "glass-bar" },
    { type: "hero", variant: "glow-center" },
    { type: "gallery", variant: "spotlight" },
    { type: "product_showcase", variant: "luxe-split" },
    { type: "features", variant: "glass-cards" },
    { type: "offers", variant: "glow-cards" },
    { type: "testimonials", variant: "glass-slider" },
    { type: "faq", variant: "glass-accordion" },
    { type: "order_form", variant: "glass-card" },
    { type: "footer", variant: "glow-columns" },
  ],
};
