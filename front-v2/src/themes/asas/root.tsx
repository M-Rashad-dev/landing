"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import "./asas.css";
import { ThemeProvider, type ThemeMode } from "./context";
import { FONT_SCALE, FONTS, inkOn, type DesignData, type Settings } from "./types";

/** The theme's frame: colors, font and size from the settings (CSS variables), and the theme context. */
export function AsasRoot({
  settings,
  data,
  storeName,
  mode,
  media = {},
  className,
  children,
}: {
  settings: Settings;
  data: DesignData;
  storeName: string;
  mode: ThemeMode;
  media?: DesignData["media"];
  className?: string;
  children: React.ReactNode;
}) {
  const font = FONTS[settings.font] ?? FONTS.cairo;
  const style = {
    "--as-primary": settings.colors.primary,
    "--as-secondary": settings.colors.secondary,
    "--as-bg": settings.colors.background,
    "--as-text": settings.colors.text,
    "--as-on-primary": inkOn(settings.colors.primary),
    "--as-on-secondary": inkOn(settings.colors.secondary),
    "--as-font": `"${font.family}"`,
    "--as-fs": String(FONT_SCALE[settings.font_size] ?? 1),
  } as React.CSSProperties;

  return (
    <ThemeProvider value={{ mode, settings, data, storeName, media }}>
      {/* React hoists the font stylesheet into the document head. */}
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${font.google}&display=swap`} precedence="default" />
      <div dir="rtl" lang="ar" data-mode={mode} className={cn("as-root relative", className)} style={style}>
        {children}
      </div>
    </ThemeProvider>
  );
}
