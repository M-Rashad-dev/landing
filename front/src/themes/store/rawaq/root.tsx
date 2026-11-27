"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { inkOn } from "@/themes/shared/design";
import type { ThemeMode } from "@/themes/store/shared/context";
import { useTheme } from "@/themes/store/shared/context";
import type { DesignData, StoreSettings } from "@/themes/store/shared/types";
import { AsasRoot } from "../asas/root";
import { RAWAQ_CARD_DEFAULTS, RAWAQ_CART_DEFAULTS, RAWAQ_LISTING_DEFAULTS, RAWAQ_PAGE_DEFAULTS, type ButtonShape, type RawaqCardSettings, type RawaqCartSettings, type RawaqData, type RawaqListingSettings, type RawaqPageSettings, type RawaqSettings } from "./types";
import "./rawaq.css";

/** The title font (the merchant can switch titles back to the body font). */
const DISPLAY = { family: "El Messiri", google: "El+Messiri:wght@500;600;700" };

const RADIUS: Record<ButtonShape, string> = { rounded: "0.8rem", pill: "999px", square: "0.2rem" };

/** The theme context with «رواق»'s settings and data types. */
export function useRawaq() {
  const theme = useTheme();
  return { ...theme, settings: theme.settings as unknown as RawaqSettings, data: theme.data as RawaqData };
}

/** The product card settings (their defaults for designs saved before them). */
export function useRawaqCard(): RawaqCardSettings {
  const { settings } = useRawaq();
  return { ...RAWAQ_CARD_DEFAULTS, ...settings.product_card };
}

/** The product page settings (their defaults for designs saved before them). */
export function useRawaqPage(): RawaqPageSettings {
  const { settings } = useRawaq();
  const page = settings.product_page;
  return { ...RAWAQ_PAGE_DEFAULTS, ...page, viewers: { ...RAWAQ_PAGE_DEFAULTS.viewers, ...page?.viewers } };
}

/** The category pages settings (their defaults for designs saved before them). */
export function useRawaqListing(): RawaqListingSettings {
  const { settings } = useRawaq();
  return { ...RAWAQ_LISTING_DEFAULTS, ...settings.listing };
}

/** The cart settings (their defaults for designs saved before them). */
export function useRawaqCart(): RawaqCartSettings {
  const { settings } = useRawaq();
  return { ...RAWAQ_CART_DEFAULTS, ...settings.cart };
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
    const watch = () => el.querySelectorAll(".rq-reveal:not([data-in])").forEach((n) => observer.observe(n));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [root, on]);
}

/** «رواق»'s frame: the shared store frame (colors, font, context) plus its dark color, title font and button shape. */
export function RawaqRoot({
  settings,
  data,
  storeName,
  mode,
  media = {},
  className,
  children,
}: {
  settings: RawaqSettings;
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
    "--rq-dark": dark,
    "--rq-on-dark": inkOn(dark) === "#ffffff" ? "#fbf1f4" : "#2b2226",
    "--rq-display": `"${settings.display_font ? DISPLAY.family : "inherit"}"`,
    "--rq-btn-radius": RADIUS[settings.button] ?? RADIUS.pill,
  } as React.CSSProperties;

  return (
    <AsasRoot settings={settings as unknown as StoreSettings} data={data} storeName={storeName} mode={mode} media={media} className={className}>
      {settings.display_font ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${DISPLAY.google}&display=swap`} precedence="default" /> : null}
      <div ref={ref} className={cn("rq-root flex min-h-full flex-1 flex-col", motion && "rq-motion")} style={style}>
        {children}
      </div>
    </AsasRoot>
  );
}
