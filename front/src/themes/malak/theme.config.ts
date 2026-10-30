import type { ComponentType, ThemeComponentDef, ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";
import { MalakFaq } from "./components/faq";
import { MalakFeatures } from "./components/features";
import { MalakFooter } from "./components/footer";
import { MalakGallery } from "./components/gallery";
import { MalakHeader } from "./components/header";
import { MalakHero } from "./components/hero";
import { MalakOffers } from "./components/offers";
import { MalakOrderForm } from "./components/order-form";
import { MalakProductShowcase } from "./components/product-showcase";
import { MalakTestimonials } from "./components/testimonials";
import { MalakBeforeAfter, MalakComparison, MalakCountdown, MalakSizeChart, MalakStickyCta, MalakVideo } from "./components/blocks";
import { MalakThumbs } from "./thumbnails";

const v = (keys: string[]) => keys.map((key) => ({ key, label: ar.themes.variants[key] ?? key }));

function def(type: ComponentType, component: ThemeComponentDef["component"], variants: string[]): ThemeComponentDef {
  return { component, variants: v(variants), defaultVariant: variants[0], Thumbnail: MalakThumbs[type] };
}

/** «ملاك» — soft and calm: big rounded corners, light shadows, airy spacing, tinted backgrounds. */
export const malakTheme: ThemeDef = {
  key: "malak",
  name: ar.themes.malak.name,
  description: ar.themes.malak.description,
  components: {
    header: def("header", MalakHeader, ["centered-logo", "logo-start"]),
    hero: def("hero", MalakHero, ["split", "full-cover", "centered-card"]),
    gallery: def("gallery", MalakGallery, ["slider", "grid"]),
    product_showcase: def("product_showcase", MalakProductShowcase, ["card", "side-by-side"]),
    features: def("features", MalakFeatures, ["icon-cards", "alternating"]),
    offers: def("offers", MalakOffers, ["cards", "ribbon-banner"]),
    testimonials: def("testimonials", MalakTestimonials, ["cards-slider", "grid"]),
    faq: def("faq", MalakFaq, ["accordion-soft", "two-columns"]),
    order_form: def("order_form", MalakOrderForm, ["card", "split-summary"]),
    footer: def("footer", MalakFooter, ["simple-center", "columns"]),
    video: def("video", MalakVideo, ["framed", "video-split"]),
    before_after: def("before_after", MalakBeforeAfter, ["drag-slider", "two-images"]),
    size_chart: def("size_chart", MalakSizeChart, ["table", "size-cards"]),
    comparison: def("comparison", MalakComparison, ["check-table", "versus-cards"]),
    countdown: def("countdown", MalakCountdown, ["boxes", "banner"]),
    sticky_cta: def("sticky_cta", MalakStickyCta, ["full-bar", "pill"]),
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
