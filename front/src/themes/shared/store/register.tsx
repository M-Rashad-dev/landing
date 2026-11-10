import type { ReactNode } from "react";
import { ar } from "@/messages/ar";
import type { BannerSliderProps, CategoryGridProps, ProductGridProps, PromoBannerProps } from "@/themes/shared/schemas";
import type { LookKey } from "@/themes/shared/sections/looks";
import type { SectionProps, ThemeComponentDef } from "@/themes/types";
import { STORE_SECTION_TYPES } from "@/themes/types";
import { BannerSliderBlock, CategoryGridBlock, ProductGridBlock, PromoBannerBlock } from "./store-blocks";

type StoreSectionType = (typeof STORE_SECTION_TYPES)[number];

const VARIANTS: Record<StoreSectionType, string[]> = {
  banner_slider: ["full-width", "contained"],
  category_grid: ["tiles", "circles"],
  product_grid: ["grid", "slider"],
  promo_banner: ["overlay", "split"],
};

/* Small wireframes for the Builder library (currentColor = primary), shared by every theme. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect x="1" y="1" width="118" height="70" rx="8" fill="currentColor" fillOpacity="0.06" />
      {children}
    </svg>
  );
}

export const STORE_THUMBS: Record<StoreSectionType, () => ReactNode> = {
  banner_slider: () => (
    <Frame>
      <rect x="6" y="8" width="108" height="48" rx="6" fill="currentColor" fillOpacity="0.25" />
      <rect x="14" y="34" width="40" height="6" rx="3" fill="currentColor" fillOpacity="0.6" />
      <rect x="14" y="44" width="22" height="7" rx="3.5" fill="currentColor" fillOpacity="0.8" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={52 + i * 8} cy="63" r="2.2" fill="currentColor" fillOpacity={i === 0 ? 0.8 : 0.3} />
      ))}
    </Frame>
  ),
  category_grid: () => (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={8 + i * 27} y="12" width="23" height="32" rx="5" fill="currentColor" fillOpacity="0.25" />
          <rect x={11 + i * 27} y="50" width="17" height="4" rx="2" fill="currentColor" fillOpacity="0.5" />
        </g>
      ))}
    </Frame>
  ),
  product_grid: () => (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={8 + i * 27} y="8" width="23" height="28" rx="4" fill="currentColor" fillOpacity="0.25" />
          <rect x={8 + i * 27} y="40" width="18" height="4" rx="2" fill="currentColor" fillOpacity="0.45" />
          <rect x={8 + i * 27} y="47" width="12" height="4" rx="2" fill="currentColor" fillOpacity="0.7" />
          <rect x={8 + i * 27} y="55" width="23" height="8" rx="4" fill="currentColor" fillOpacity="0.8" />
        </g>
      ))}
    </Frame>
  ),
  promo_banner: () => (
    <Frame>
      <rect x="6" y="10" width="108" height="52" rx="8" fill="currentColor" fillOpacity="0.3" />
      <rect x="16" y="20" width="20" height="5" rx="2.5" fill="currentColor" fillOpacity="0.5" />
      <rect x="16" y="30" width="48" height="7" rx="3.5" fill="currentColor" fillOpacity="0.75" />
      <rect x="16" y="44" width="26" height="8" rx="4" fill="currentColor" fillOpacity="0.9" />
    </Frame>
  ),
};

/**
 * The four store-home sections for a theme: shared markup in the theme's look
 * (themes/shared/sections/looks.ts), the same variants in every theme.
 */
export function storeSectionDefs(look: LookKey): Record<StoreSectionType, ThemeComponentDef> {
  const v = (type: StoreSectionType) => VARIANTS[type].map((key) => ({ key, label: ar.themes.variants[key] ?? key }));
  const make = <P,>(type: StoreSectionType, Block: (p: SectionProps<P> & { look: LookKey }) => ReactNode, name: string): ThemeComponentDef => {
    const Component = (p: SectionProps<P>) => <Block {...p} look={look} />;
    Component.displayName = `${name}(${look})`;
    return { component: Component, variants: v(type), defaultVariant: VARIANTS[type][0], Thumbnail: STORE_THUMBS[type] };
  };
  return {
    banner_slider: make<BannerSliderProps>("banner_slider", BannerSliderBlock, "BannerSlider"),
    category_grid: make<CategoryGridProps>("category_grid", CategoryGridBlock, "CategoryGrid"),
    product_grid: make<ProductGridProps>("product_grid", ProductGridBlock, "ProductGrid"),
    promo_banner: make<PromoBannerProps>("promo_banner", PromoBannerBlock, "PromoBanner"),
  };
}
