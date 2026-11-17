"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import "@/themes/shared/base.css";
import "../bidaya/bidaya.css";
import "./sufi.css";
import { FONT_SCALE, FONTS, inkOn, type MediaUrls } from "@/themes/shared/design";
import { useReveal, useVisitorScheme, type Scheme } from "@/themes/shared/scheme";
import { PageProvider, type PageMode } from "@/themes/landing/bidaya/context";
import { BUTTON_RADIUS, type LandingData } from "@/themes/landing/bidaya/types";
import type { SufiLandingSettings } from "./types";

/** The title font of «صوفي» (the merchant can switch titles back to the body font). */
const DISPLAY = { family: "Amiri", google: "Amiri:wght@400;700" };

const SchemeContext = React.createContext<{ scheme: Scheme; toggle: (() => void) | null }>({ scheme: "light", toggle: null });

/** The scheme drawn now, and the visitor's switch (null when the merchant turned it off or outside the live page). */
export function useSufiScheme() {
  return React.useContext(SchemeContext);
}

/*
 * The Builder shows the page in light or dark on the merchant's request (the switch sits in the
 * theme's look settings); the live page follows the visitor.
 */
const builderListeners = new Set<() => void>();
let builderScheme: Scheme | null = null;

export function setBuilderScheme(scheme: Scheme | null) {
  builderScheme = scheme;
  builderListeners.forEach((l) => l());
}

export function useBuilderScheme(): Scheme | null {
  return React.useSyncExternalStore(
    (on) => {
      builderListeners.add(on);
      return () => builderListeners.delete(on);
    },
    () => builderScheme,
    () => null,
  );
}

/** Colors of the current scheme, fonts, size and button shape as CSS variables, inside the shared landing page context. */
export function SufiLandingRoot({ settings, data, mode, media = {}, className, children }: { settings: SufiLandingSettings; data: LandingData; mode: PageMode; media?: Record<string, MediaUrls>; className?: string; children: React.ReactNode }) {
  const [visitor, toggle] = useVisitorScheme(settings.appearance, mode === "live");
  const forced = useBuilderScheme();
  // The Builder's preview choice lasts until the Builder closes.
  React.useEffect(() => (mode === "builder" ? () => setBuilderScheme(null) : undefined), [mode]);
  const scheme = mode === "builder" && forced ? forced : visitor;
  const ref = React.useRef<HTMLDivElement>(null);
  // Motion everywhere but the Builder (sections there must show at once to be edited).
  const motion = settings.general.animations && mode !== "builder";
  useReveal(ref, motion, ".sl-reveal");

  const colors = scheme === "dark" ? settings.colors_dark : settings.colors;
  const font = FONTS[settings.font] ?? FONTS.almarai;
  const display = settings.display_font ? DISPLAY.family : font.family;
  const style = {
    "--as-primary": colors.primary,
    "--as-secondary": colors.secondary,
    "--as-bg": colors.background,
    "--as-text": colors.text,
    "--as-on-primary": inkOn(colors.primary),
    "--as-on-secondary": inkOn(colors.secondary),
    "--as-font": `"${font.family}"`,
    "--sl-display": `"${display}"`,
    "--as-fs": String(FONT_SCALE[settings.font_size] ?? 1),
    "--bd-radius": BUTTON_RADIUS[settings.button] ?? BUTTON_RADIUS.pill,
    colorScheme: scheme,
  } as React.CSSProperties;
  const families = settings.display_font ? `family=${font.google}&family=${DISPLAY.google}` : `family=${font.google}`;
  const fontHref = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  const value = React.useMemo(() => ({ scheme, toggle: settings.appearance.toggle && mode === "live" ? toggle : null }), [scheme, toggle, settings.appearance.toggle, mode]);

  return (
    <PageProvider value={{ mode, settings, data, media }}>
      <SchemeContext.Provider value={value}>
        {mode === "live" ? <link rel="stylesheet" href={fontHref} precedence="default" /> : <link rel="stylesheet" href={fontHref} />}
        <div
          ref={ref}
          dir="rtl"
          lang="ar"
          data-mode={mode}
          data-scheme={scheme}
          data-display={settings.display_font ? "display" : "body"}
          className={cn("as-root bd-root sl-root relative", motion && "sl-motion", className)}
          style={style}
        >
          {children}
        </div>
      </SchemeContext.Provider>
    </PageProvider>
  );
}
