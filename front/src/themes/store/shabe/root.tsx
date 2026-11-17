"use client";

import { Beef, Bike, ChefHat, Flame, Leaf, Soup, Sparkles, Star, Thermometer, Timer, UtensilsCrossed, type LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { inkOn } from "@/themes/shared/design";
import type { ThemeMode } from "@/themes/store/shared/context";
import { useTheme } from "@/themes/store/shared/context";
import type { DesignData, StoreSettings } from "@/themes/store/shared/types";
import { AsasRoot } from "../asas/root";
import { FEATURE_ICONS } from "../asas/icons";
import { CARD_DEFAULTS, CART_DEFAULTS, LISTING_DEFAULTS, PAGE_DEFAULTS, type ButtonShape, type CardSettings, type CartSettings, type ListingSettings, type FoodIcon, type PageSettings, type ShabeStoreData, type ShabeStoreSettings } from "./types";
import "./shabe-store.css";

/** The title font (the merchant can switch titles back to the body font). */
const DISPLAY = { family: "Lalezar", google: "Lalezar" };

const RADIUS: Record<ButtonShape, string> = { rounded: "0.8rem", pill: "999px", square: "0.2rem" };

/** The base icons plus the kitchen ones (keys: App\Themes\Store\StoreSections::FOOD_ICONS). */
const ICONS: Record<FoodIcon, LucideIcon> = {
  ...FEATURE_ICONS,
  flame: Flame,
  chef: ChefHat,
  leaf: Leaf,
  utensils: UtensilsCrossed,
  meat: Beef,
  timer: Timer,
  thermo: Thermometer,
  bike: Bike,
  soup: Soup,
  sparkle: Sparkles,
};
export const FOOD_ICON_KEYS = Object.keys(ICONS) as FoodIcon[];

export function FoodIconView({ name, className }: { name: FoodIcon; className?: string }) {
  const Glyph = ICONS[name] ?? Star;
  return <Glyph className={className} aria-hidden />;
}

/** The theme context with «شابع»'s settings and data types. */
export function useShabe() {
  const theme = useTheme();
  return { ...theme, settings: theme.settings as unknown as ShabeStoreSettings, data: theme.data as ShabeStoreData };
}

/** The product card settings (their defaults for designs saved before them). */
export function useCardSettings(): CardSettings {
  const { settings } = useShabe();
  return { ...CARD_DEFAULTS, ...settings.product_card };
}

/** The category pages settings (their defaults for designs saved before them). */
export function useListingSettings(): ListingSettings {
  const { settings } = useShabe();
  return { ...LISTING_DEFAULTS, ...settings.listing };
}

/** The cart settings (their defaults for designs saved before them). */
export function useCartSettings(): CartSettings {
  const { settings } = useShabe();
  return { ...CART_DEFAULTS, ...settings.cart };
}

/** The product page settings (their defaults for designs saved before them). */
export function usePageSettings(): PageSettings {
  const { settings } = useShabe();
  const page = settings.product_page;
  return { ...PAGE_DEFAULTS, ...page, viewers: { ...PAGE_DEFAULTS.viewers, ...page?.viewers } };
}

/** Sections rise in as they reach the screen (when the merchant keeps motion on). */
function useReveal(root: React.RefObject<HTMLDivElement | null>, on: boolean) {
  React.useEffect(() => {
    const el = root.current;
    if (!on || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-in", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const watch = () => el.querySelectorAll(".ss-reveal:not([data-in])").forEach((n) => observer.observe(n));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [root, on]);
}

/** «شابع»'s frame: the shared store frame (colors, font, context) plus its dark color, title font and button shape. */
export function ShabeStoreRoot({
  settings,
  data,
  storeName,
  mode,
  media = {},
  className,
  children,
}: {
  settings: ShabeStoreSettings;
  data: DesignData;
  storeName: string;
  mode: ThemeMode;
  media?: DesignData["media"];
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const motion = settings.general.animations && mode !== "builder";
  useReveal(ref, motion);
  const dark = settings.colors.dark;
  const style = {
    "--ss-dark": dark,
    "--ss-on-dark": inkOn(dark) === "#ffffff" ? "#fff6ec" : "#1b120c",
    "--ss-display": `"${settings.display_font ? DISPLAY.family : "inherit"}"`,
    "--ss-btn-radius": RADIUS[settings.button] ?? RADIUS.pill,
  } as React.CSSProperties;

  return (
    <AsasRoot settings={settings as unknown as StoreSettings} data={data} storeName={storeName} mode={mode} media={media} className={className}>
      {settings.display_font ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${DISPLAY.google}&display=swap`} precedence="default" /> : null}
      <div ref={ref} className={cn("ss-root flex min-h-full flex-1 flex-col", motion && "ss-motion")} data-display={settings.display_font ? "display" : "body"} style={style}>
        {children}
      </div>
    </AsasRoot>
  );
}
