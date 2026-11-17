"use client";

import * as React from "react";

/** Light or dark, as a theme with a dark mode draws it. */
export type Scheme = "light" | "dark";

/** What the merchant chose: the default scheme ("system" = the device's) and whether visitors can switch. */
export type Appearance = { default: "light" | "dark" | "system"; toggle: boolean };

/** One key for every theme with a dark mode: a visitor who picked dark on the store sees the landing pages dark too. */
const SCHEME_KEY = "sf_scheme";

/*
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

/** The scheme to draw now and the switch (outside the live page: always the merchant's default). */
export function useVisitorScheme(appearance: Appearance, live: boolean): [Scheme, () => void] {
  const fallback: Scheme = appearance.default === "dark" ? "dark" : "light";
  const [saved, system] = React.useSyncExternalStore(subscribe, snapshot, () => "|").split("|");

  let scheme: Scheme = fallback;
  if (appearance.toggle && (saved === "light" || saved === "dark")) scheme = saved;
  else if (appearance.default === "system" && system === "dark") scheme = "dark";

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

/** Elements matching `selector` fade in as they reach the screen (when `on`); later ones are watched too. */
export function useReveal(root: React.RefObject<HTMLElement | null>, on: boolean, selector: string) {
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
    const watch = () => el.querySelectorAll(`${selector}:not([data-in])`).forEach((n) => observer.observe(n));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [root, on, selector]);
}
