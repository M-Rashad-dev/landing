"use client";

import * as React from "react";
import { inkOn } from "@/themes/shared/design";
import type { ThemeMode } from "@/themes/store/shared/context";
import { useTheme } from "@/themes/store/shared/context";
import type { DesignData, StoreSettings } from "@/themes/store/shared/types";
import { AsasRoot } from "../asas/root";
import { TEKNO_CARD_DEFAULTS, type ButtonShape, type TeknoCardSettings, type TeknoData, type TeknoInstallments, type TeknoSettings } from "./types";
import "./tekno.css";

/** The title font (the merchant can switch titles back to the body font). */
const DISPLAY = { family: "Readex Pro", google: "Readex+Pro:wght@500;600;700" };

const RADIUS: Record<ButtonShape, string> = { rounded: "0.75rem", pill: "999px", square: "0.25rem" };

/** Installments as a design saved without them reads them: off. */
const NO_INSTALLMENTS: TeknoInstallments = { enabled: false, months: [12], card_months: 12, interest_percent: 0, min_price: 0, providers: [], note: null };

/** The theme context with «تيكنو»'s settings and data types. */
export function useTekno() {
  const theme = useTheme();
  return { ...theme, settings: theme.settings as unknown as TeknoSettings, data: theme.data as TeknoData };
}

/** The product card settings. */
export function useTeknoCard(): TeknoCardSettings {
  const { settings } = useTekno();
  return { ...TEKNO_CARD_DEFAULTS, ...settings.product_card };
}

/** «التقسيط» (display only). */
export function useInstallments(): TeknoInstallments {
  const { settings } = useTekno();
  return settings.installments ?? NO_INSTALLMENTS;
}

/** «تيكنو»'s frame: the shared store frame (colors, font, context) plus its navy and lime colors, title font and button shape. */
export function TeknoRoot({
  settings,
  data,
  storeName,
  mode,
  media = {},
  className,
  children,
}: {
  settings: TeknoSettings;
  data: DesignData;
  storeName: string;
  mode: ThemeMode;
  media?: DesignData["media"];
  className?: string;
  children: React.ReactNode;
}) {
  const dark = settings.colors.dark;
  const deal = settings.colors.deal;
  const style = {
    "--tk-dark": dark,
    "--tk-on-dark": inkOn(dark) === "#ffffff" ? "#ffffff" : "#0b1220",
    "--tk-deal": deal,
    "--tk-on-deal": inkOn(deal),
    "--tk-display": `"${settings.display_font ? DISPLAY.family : "inherit"}"`,
    "--tk-btn-radius": RADIUS[settings.button] ?? RADIUS.rounded,
  } as React.CSSProperties;

  return (
    <AsasRoot settings={settings as unknown as StoreSettings} data={data} storeName={storeName} mode={mode} media={media} className={className}>
      {settings.display_font ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${DISPLAY.google}&display=swap`} precedence="default" /> : null}
      <div className="tk-root flex min-h-full flex-1 flex-col" style={style}>
        {children}
      </div>
    </AsasRoot>
  );
}
