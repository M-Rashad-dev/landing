import type { ComponentType, ThemeComponentDef, ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";
import { CeliaFaq } from "./components/faq";
import { CeliaFeatures } from "./components/features";
import { CeliaFooter } from "./components/footer";
import { CeliaGallery } from "./components/gallery";
import { CeliaHeader } from "./components/header";
import { CeliaHero } from "./components/hero";
import { CeliaOffers } from "./components/offers";
import { CeliaOrderForm } from "./components/order-form";
import { CeliaProductShowcase } from "./components/product-showcase";
import { CeliaTestimonials } from "./components/testimonials";
import { CeliaBeforeAfter, CeliaComparison, CeliaCountdown, CeliaSizeChart, CeliaStickyCta, CeliaVideo } from "./components/blocks";
import { CeliaThumbs } from "./thumbnails";

const v = (keys: string[]) => keys.map((key) => ({ key, label: ar.themes.variants[key] ?? key }));

function def(type: ComponentType, component: ThemeComponentDef["component"], variants: string[]): ThemeComponentDef {
  return { component, variants: v(variants), defaultVariant: variants[0], Thumbnail: CeliaThumbs[type] };
}

/** «سيليا» — bold and modern: hard borders, solid shadows, huge type, dark bands. */
export const celiaTheme: ThemeDef = {
  key: "celia",
  name: ar.themes.celia.name,
  description: ar.themes.celia.description,
  components: {
    header: def("header", CeliaHeader, ["bar", "minimal"]),
    hero: def("hero", CeliaHero, ["big-type", "split-reverse", "full-cover"]),
    gallery: def("gallery", CeliaGallery, ["thumbs-side", "masonry"]),
    product_showcase: def("product_showcase", CeliaProductShowcase, ["split-image", "stacked"]),
    features: def("features", CeliaFeatures, ["numbered-grid", "icon-list"]),
    offers: def("offers", CeliaOffers, ["bundle-tiles", "countdown-strip"]),
    testimonials: def("testimonials", CeliaTestimonials, ["quote-wall", "screenshots-grid"]),
    faq: def("faq", CeliaFaq, ["accordion-lines", "numbered"]),
    order_form: def("order_form", CeliaOrderForm, ["bordered", "sticky-summary"]),
    footer: def("footer", CeliaFooter, ["dark-columns", "minimal-line"]),
    video: def("video", CeliaVideo, ["framed", "video-split"]),
    before_after: def("before_after", CeliaBeforeAfter, ["drag-slider", "two-images"]),
    size_chart: def("size_chart", CeliaSizeChart, ["table", "size-cards"]),
    comparison: def("comparison", CeliaComparison, ["check-table", "versus-cards"]),
    countdown: def("countdown", CeliaCountdown, ["banner", "boxes"]),
    sticky_cta: def("sticky_cta", CeliaStickyCta, ["full-bar", "pill"]),
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
