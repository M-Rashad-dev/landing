"use client";

import { ArrowRight, Laptop, Moon, ShoppingBag, Smartphone, Sun } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { Content } from "@/themes/landing/bidaya/types";
import { LANDING_DEMOS } from "@/themes/landing/demos";
import type { LandingThemeKey } from "@/themes/landing/keys";
import { landingTheme } from "@/themes/landing/registry";
import type { Scheme } from "@/themes/shared/scheme";
import { useLandingTheme } from "./api";
import { buyUrl } from "./theme-gallery";

const t = ar.landings.theme;
const b = t.demoBar;

type Device = "mobile" | "desktop";

/**
 * A landing theme's showcase page, full screen: phone first (most visitors of a landing page come
 * from ads on their phones), computer on demand, light or dark for themes that have it, and «اشتريه».
 * The page is drawn as a preview: the order form sends nothing.
 */
export function LandingThemeDemo({ themeKey }: { themeKey: LandingThemeKey }) {
  const [device, setDevice] = React.useState<Device>("mobile");
  const [scheme, setScheme] = React.useState<Scheme>("light");
  const detail = `/dashboard/marketing/landings/themes/${encodeURIComponent(themeKey)}`;
  const theme = useLandingTheme(themeKey);
  const demo = LANDING_DEMOS[themeKey];
  const { Page } = landingTheme(themeKey);
  // Made once (the countdowns end a few hours from now), the scheme set from the bar.
  const [base] = React.useState(demo.content);
  const content = React.useMemo<Content>(() => (demo.schemes ? ({ ...base, settings: { ...base.settings, appearance: { default: scheme, toggle: false } } } as Content) : base), [base, demo.schemes, scheme]);
  const usable = theme.data?.is_free || theme.data?.owned === true;

  const toggle = <T extends string>(value: T, current: T, set: (v: T) => void, Icon: typeof Sun, label: string) => (
    <button type="button" onClick={() => set(value)} aria-pressed={current === value} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition", current === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
      <Icon className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex h-dvh flex-col bg-surface-2">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <Button asChild size="sm" variant="ghost">
          <Link href={detail}>
            <ArrowRight />
            <span className="hidden sm:inline">{b.back}</span>
          </Link>
        </Button>
        <span className="font-display text-sm font-semibold">{theme.data?.name ?? ""}</span>
        <span className="hidden rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink md:inline">{b.label}</span>
        <div className="mx-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-surface-2 p-0.5">
            {toggle("mobile", device, setDevice, Smartphone, b.mobile)}
            {toggle("desktop", device, setDevice, Laptop, b.desktop)}
          </div>
          {demo.schemes ? (
            <div className="flex rounded-lg bg-surface-2 p-0.5">
              {toggle("light", scheme, setScheme, Sun, b.light)}
              {toggle("dark", scheme, setScheme, Moon, b.dark)}
            </div>
          ) : null}
        </div>
        <Button asChild size="sm">
          <Link href={usable ? detail : buyUrl(themeKey)}>
            <ShoppingBag />
            {usable ? ar.landings.gallery.use : t.buy}
          </Link>
        </Button>
      </header>
      <p className="bg-accent-soft/60 px-4 py-1.5 text-center text-xs text-ink-2">{b.note}</p>
      <div className="min-h-0 flex-1 overflow-hidden p-0 md:p-4">
        {/* The transform makes the frame hold the page's fixed parts (WhatsApp button, sticky order bar). */}
        <div className={cn("relative mx-auto h-full overflow-hidden bg-white shadow-sm transition-[width] [transform:translateZ(0)]", device === "mobile" ? "w-[390px] max-w-full rounded-[2rem] border-8 border-ink" : "w-full md:rounded-xl")} data-device={device}>
          <div className="h-full overflow-y-auto">
            <Page content={content} data={demo.data} mode="preview" />
          </div>
        </div>
      </div>
    </div>
  );
}
