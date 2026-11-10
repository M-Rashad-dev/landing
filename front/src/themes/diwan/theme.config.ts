import type { ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";
import { layaliTheme } from "@/themes/layali/theme.config";
import { storeSectionDefs } from "@/themes/shared/store/register";

/**
 * «ديوان» — the paid store theme: night luxury (the Layali look: a dark page made from the
 * store's colors, glass surfaces, glows), with the shared store layout in themes/store.
 */
export const diwanTheme: ThemeDef = {
  key: "diwan",
  kind: "store",
  name: ar.themes.diwan.name,
  description: ar.themes.diwan.description,
  components: { ...layaliTheme.components, ...storeSectionDefs("layali") },
  starterSections: [
    { type: "banner_slider", variant: "contained" },
    { type: "product_grid", variant: "slider" },
    { type: "category_grid", variant: "circles" },
    { type: "promo_banner", variant: "split" },
    { type: "testimonials", variant: "glass-slider" },
  ],
};
