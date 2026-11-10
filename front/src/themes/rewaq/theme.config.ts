import type { ThemeDef } from "@/themes/types";
import { ar } from "@/messages/ar";
import { malakTheme } from "@/themes/malak/theme.config";
import { storeSectionDefs } from "@/themes/shared/store/register";

/**
 * «رواق» — the free store theme: light and calm (the Malak look), with the store layout
 * (header with cart and search, product pages, listing, cart, checkout) in themes/store.
 */
export const rewaqTheme: ThemeDef = {
  key: "rewaq",
  kind: "store",
  name: ar.themes.rewaq.name,
  description: ar.themes.rewaq.description,
  components: { ...malakTheme.components, ...storeSectionDefs("malak") },
  starterSections: [
    { type: "banner_slider", variant: "full-width" },
    { type: "category_grid", variant: "tiles" },
    { type: "product_grid", variant: "grid" },
    { type: "promo_banner", variant: "overlay" },
    { type: "features", variant: "icon-cards" },
  ],
};
