"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import "../asas/asas.css";
import "../bidaya/bidaya.css";
import "./shabe.css";
import { FONT_SCALE, FONTS, inkOn, type MediaUrls } from "@/themes/asas/types";
import { PageProvider, type PageMode } from "@/themes/bidaya/context";
import { BUTTON_RADIUS, type LandingData } from "@/themes/bidaya/types";
import type { ShabeSettings } from "./types";

/** The title font of «شابع» (the merchant can switch titles back to the body font). */
const DISPLAY = { family: "Lalezar", google: "Lalezar" };

/** Colors, fonts, size and button shape as CSS variables, inside the shared landing page context. */
export function ShabeRoot({ settings, data, mode, media = {}, className, children }: { settings: ShabeSettings; data: LandingData; mode: PageMode; media?: Record<string, MediaUrls>; className?: string; children: React.ReactNode }) {
  const font = FONTS[settings.font] ?? FONTS.cairo;
  const display = settings.display_font ? DISPLAY.family : font.family;
  const style = {
    "--as-primary": settings.colors.primary,
    "--as-secondary": settings.colors.secondary,
    "--as-bg": settings.colors.background,
    "--as-text": settings.colors.text,
    "--as-on-primary": inkOn(settings.colors.primary),
    "--as-on-secondary": inkOn(settings.colors.secondary),
    "--sh-dark": settings.colors.dark,
    "--sh-on-dark": inkOn(settings.colors.dark) === "#ffffff" ? "#fff6ec" : "#1b120c",
    "--as-font": `"${font.family}"`,
    "--sh-display": `"${display}"`,
    "--as-fs": String(FONT_SCALE[settings.font_size] ?? 1),
    "--bd-radius": BUTTON_RADIUS[settings.button] ?? BUTTON_RADIUS.rounded,
  } as React.CSSProperties;
  const families = settings.display_font ? `family=${font.google}&family=${DISPLAY.google}` : `family=${font.google}`;
  const fontHref = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  return (
    <PageProvider value={{ mode, settings, data, media }}>
      {mode === "live" ? <link rel="stylesheet" href={fontHref} precedence="default" /> : <link rel="stylesheet" href={fontHref} />}
      <div dir="rtl" lang="ar" data-mode={mode} data-display={settings.display_font ? "display" : "body"} className={cn("as-root bd-root sh-root relative", className)} style={style}>
        {children}
      </div>
    </PageProvider>
  );
}
