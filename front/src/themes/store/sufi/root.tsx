"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AsasRoot } from "../asas/root";
import type { ThemeMode } from "@/themes/store/shared/context";
import type { DesignData } from "@/themes/store/shared/types";
import { useReveal, useVisitorScheme } from "@/themes/shared/scheme";
import type { Scheme, SufiSettings } from "./types";
import "./sufi.css";

const SchemeContext = React.createContext<{ scheme: Scheme; toggle: (() => void) | null }>({ scheme: "light", toggle: null });

export function useScheme() {
  return React.useContext(SchemeContext);
}

/** «صوفي»'s frame: the shared store frame with the colors of the current scheme, and its own variables. */
export function SufiRoot({
  settings,
  data,
  storeName,
  mode,
  media = {},
  scheme: forced,
  className,
  children,
}: {
  settings: SufiSettings;
  data: DesignData;
  storeName: string;
  mode: ThemeMode;
  media?: DesignData["media"];
  /** The Builder previews one scheme or the other. */
  scheme?: Scheme;
  className?: string;
  children: React.ReactNode;
}) {
  const [visitor, toggle] = useVisitorScheme(settings.appearance, mode === "live");
  const scheme = forced ?? visitor;
  const ref = React.useRef<HTMLDivElement>(null);
  // Motion everywhere but the Builder (sections there must show at once to be edited).
  const motion = settings.general.animations && mode !== "builder";
  useReveal(ref, motion, ".sf-reveal");

  const colors = scheme === "dark" ? settings.colors_dark : settings.colors;
  const value = React.useMemo(() => ({ scheme, toggle: settings.appearance.toggle && mode === "live" ? toggle : null }), [scheme, toggle, settings.appearance.toggle, mode]);

  return (
    <SchemeContext.Provider value={value}>
      <AsasRoot settings={{ ...settings, colors }} data={data} storeName={storeName} mode={mode} media={media} className={className}>
        <div
          ref={ref}
          className={cn("sf-root flex min-h-full flex-1 flex-col", motion && "sf-motion")}
          data-scheme={scheme}
          data-layout={settings.header.layout}
          data-topbar={settings.header.topbar ? "" : undefined}
          data-height={settings.header.height ?? "md"}
          style={{ colorScheme: scheme }}
        >
          {children}
        </div>
      </AsasRoot>
    </SchemeContext.Provider>
  );
}
