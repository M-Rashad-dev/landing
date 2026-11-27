"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import "@/themes/shared/base.css";
import "../bidaya/bidaya.css";
import "./rawaq.css";
import { FONT_SCALE, FONTS, inkOn, type MediaUrls } from "@/themes/shared/design";
import { useReveal } from "@/themes/shared/scheme";
import { PageProvider, type PageMode } from "@/themes/landing/bidaya/context";
import { BUTTON_RADIUS, type LandingData } from "@/themes/landing/bidaya/types";
import type { RawaqLandingSettings } from "./types";

/** The title font of «رواق» (the merchant can switch titles back to the body font). */
const DISPLAY = { family: "El Messiri", google: "El+Messiri:wght@500;700" };

/** Colors, fonts, size and button shape as CSS variables, inside the shared landing page context. */
export function RawaqLandingRoot({ settings, data, mode, media = {}, className, children }: { settings: RawaqLandingSettings; data: LandingData; mode: PageMode; media?: Record<string, MediaUrls>; className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Motion everywhere but the Builder (sections there must show at once to be edited).
  const motion = settings.general.animations && mode !== "builder";
  useReveal(ref, motion, ".rl-reveal");

  const font = FONTS[settings.font] ?? FONTS.cairo;
  const display = settings.display_font ? DISPLAY.family : font.family;
  const style = {
    "--as-primary": settings.colors.primary,
    "--as-secondary": settings.colors.secondary,
    "--as-bg": settings.colors.background,
    "--as-text": settings.colors.text,
    "--as-on-primary": inkOn(settings.colors.primary),
    "--as-on-secondary": inkOn(settings.colors.secondary),
    "--rl-dark": settings.colors.dark,
    "--rl-on-dark": inkOn(settings.colors.dark) === "#ffffff" ? "#fbf3f5" : "#2b2226",
    "--as-font": `"${font.family}"`,
    "--rl-display": `"${display}"`,
    "--as-fs": String(FONT_SCALE[settings.font_size] ?? 1),
    "--bd-radius": BUTTON_RADIUS[settings.button] ?? BUTTON_RADIUS.pill,
  } as React.CSSProperties;
  const families = settings.display_font ? `family=${font.google}&family=${DISPLAY.google}` : `family=${font.google}`;
  const fontHref = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  return (
    <PageProvider value={{ mode, settings, data, media }}>
      {mode === "live" ? <link rel="stylesheet" href={fontHref} precedence="default" /> : <link rel="stylesheet" href={fontHref} />}
      <div ref={ref} dir="rtl" lang="ar" data-mode={mode} data-display={settings.display_font ? "display" : "body"} className={cn("as-root bd-root rl-root relative", motion && "rl-motion", className)} style={style}>
        {children}
      </div>
    </PageProvider>
  );
}
