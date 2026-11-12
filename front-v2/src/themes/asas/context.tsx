"use client";

import * as React from "react";
import type { DesignData, Settings } from "./types";

/** Where the theme is drawn: the live store, the Builder (links inert, sections selectable), or a preview (links inert). */
export type ThemeMode = "live" | "builder" | "preview";

type Ctx = {
  mode: ThemeMode;
  settings: Settings;
  data: DesignData;
  storeName: string;
  /** Extra images the Builder picked before the server knew them. */
  media: DesignData["media"];
};

const ThemeContext = React.createContext<Ctx | null>(null);

export function ThemeProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside the theme");
  return ctx;
}

/** A store link: real in the store, inert in the Builder (clicks select the section instead). */
export function StoreLink({ href, className, children, ...rest }: { href: string | null | undefined; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<"a">, "href">) {
  const { mode } = useTheme();
  if (!href) return <span className={className}>{children}</span>;
  if (mode !== "live") {
    return (
      <a href={href} className={className} onClick={(e) => e.preventDefault()} {...rest}>
        {children}
      </a>
    );
  }
  const external = /^https?:\/\//.test(href);
  return (
    <a href={href} className={className} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
      {children}
    </a>
  );
}
