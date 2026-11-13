"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import "../asas/asas.css";
import "./bidaya.css";
import { FONT_SCALE, FONTS, inkOn, pick, type MediaUrls } from "@/themes/asas/types";
import { BUTTON_RADIUS, type LandingData, type Settings } from "./types";

/** Where the page is drawn: the live page, the Builder (sections selectable, nothing sent), or a preview. */
export type PageMode = "live" | "builder" | "preview";

type Ctx = {
  mode: PageMode;
  settings: Settings;
  data: LandingData;
  /** Images the Builder picked before the server knew them. */
  media: Record<string, MediaUrls>;
};

const PageContext = React.createContext<Ctx | null>(null);

export function usePage(): Ctx {
  const ctx = React.useContext(PageContext);
  if (!ctx) throw new Error("usePage outside «بداية»");
  return ctx;
}

/** A picked image's urls: from the Builder first, else from the page data. */
export function useImage(id: number | null | undefined): MediaUrls | null {
  const { media, data } = usePage();
  if (!id) return null;
  return media[String(id)] ?? data.media[String(id)]?.urls ?? null;
}

/** The product's own pictures (the page falls back to them when it has none). */
export function useProductImages(): MediaUrls[] {
  const { data } = usePage();
  return (data.product?.images ?? []).map((image) => image.urls);
}

export const imageSrc = (urls: MediaUrls | null, size: "thumb" | "medium" | "large") => pick(urls, size);

/** Colors, font, size and button shape as CSS variables; the same utilities as the store theme. */
export function BidayaRoot({ settings, data, mode, media = {}, className, children }: { settings: Settings; data: LandingData; mode: PageMode; media?: Record<string, MediaUrls>; className?: string; children: React.ReactNode }) {
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
    "--bd-radius": BUTTON_RADIUS[settings.button] ?? BUTTON_RADIUS.rounded,
  } as React.CSSProperties;
  const fontHref = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;

  return (
    <PageContext.Provider value={{ mode, settings, data, media }}>
      {/* The live page hoists the font into the head (React waits for it, no flash of another font);
          the Builder loads it in place so a font change never holds the editor back. */}
      {mode === "live" ? (
        <link rel="stylesheet" href={fontHref} precedence="default" />
      ) : (
        <link rel="stylesheet" href={fontHref} />
      )}
      <div dir="rtl" lang="ar" data-mode={mode} className={cn("as-root bd-root relative", className)} style={style}>
        {children}
      </div>
    </PageContext.Provider>
  );
}

/** Scrolls to the order form (the page's own anchor; inert in the Builder). */
export function scrollToOrder(mode: PageMode) {
  if (mode === "builder") return;
  document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
