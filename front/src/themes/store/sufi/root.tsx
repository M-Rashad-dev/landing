"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AsasRoot } from "../asas/root";
import type { ThemeMode } from "@/themes/store/shared/context";
import type { DesignData } from "@/themes/store/shared/types";
import type { Scheme, SufiSettings } from "./types";
import "./sufi.css";

const SCHEME_KEY = "sf_scheme";

const SchemeContext = React.createContext<{ scheme: Scheme; toggle: (() => void) | null }>({ scheme: "light", toggle: null });

export function useScheme() {
  return React.useContext(SchemeContext);
}

/**
 * The visitor's light / dark choice: the merchant's default, the device's for "system", and the
 * visitor's own once they pressed the switch (kept in this browser). The first paint uses the
 * merchant's default so the server and the browser draw the same page.
 */
const listeners = new Set<() => void>();
let pageChoice: Scheme | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
    media?.removeEventListener?.("change", onChange);
  };
}

/** "stored|system": the visitor's saved choice and whether the device is dark. */
function snapshot(): string {
  let saved: string | null = pageChoice;
  try {
    saved = window.localStorage.getItem(SCHEME_KEY) ?? pageChoice;
  } catch {
    // Storage blocked: the choice made on this page.
  }
  return `${saved ?? ""}|${window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"}`;
}

function useVisitorScheme(settings: SufiSettings, live: boolean): [Scheme, () => void] {
  const fallback: Scheme = settings.appearance.default === "dark" ? "dark" : "light";
  const [saved, system] = React.useSyncExternalStore(subscribe, snapshot, () => "|").split("|");

  let scheme: Scheme = fallback;
  if (settings.appearance.toggle && (saved === "light" || saved === "dark")) scheme = saved;
  else if (settings.appearance.default === "system" && system === "dark") scheme = "dark";

  const toggle = React.useCallback(() => {
    const next: Scheme = scheme === "dark" ? "light" : "dark";
    pageChoice = next;
    try {
      window.localStorage.setItem(SCHEME_KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    listeners.forEach((l) => l());
  }, [scheme]);

  return [live ? scheme : fallback, toggle];
}

/** Sections fade in as they reach the screen (when the merchant keeps motion on). */
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
    const watch = () => el.querySelectorAll(".sf-reveal:not([data-in])").forEach((n) => observer.observe(n));
    watch();
    // Sections added later (another page, the Builder) are watched too.
    const mutations = new MutationObserver(watch);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [root, on]);
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
  const [visitor, toggle] = useVisitorScheme(settings, mode === "live");
  const scheme = forced ?? visitor;
  const ref = React.useRef<HTMLDivElement>(null);
  // Motion everywhere but the Builder (sections there must show at once to be edited).
  const motion = settings.general.animations && mode !== "builder";
  useReveal(ref, motion);

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
