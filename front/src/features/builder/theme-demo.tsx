"use client";

import { ArrowRight, Laptop, Moon, ShoppingBag, Smartphone, Sun } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SUFI_DEMO_DATA, SUFI_DEMO_DESIGN } from "@/themes/sufi/demo";
import { SufiStore } from "@/themes/sufi/sufi-store";
import type { Scheme } from "@/themes/sufi/types";
import { useStoreTheme } from "./api";

const t = ar.design.page;
const b = t.demoBar;

/** A theme's showcase store, full screen: computer or phone width, light or dark, and «اشتريه». */
export function ThemeDemo({ themeKey }: { themeKey: string }) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [scheme, setScheme] = React.useState<Scheme>("light");
  const detail = `/dashboard/design/themes/${encodeURIComponent(themeKey)}`;
  const theme = useStoreTheme(themeKey);

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
            {toggle("desktop", device, setDevice, Laptop, b.desktop)}
            {toggle("mobile", device, setDevice, Smartphone, b.mobile)}
          </div>
          <div className="flex rounded-lg bg-surface-2 p-0.5">
            {toggle("light", scheme, setScheme, Sun, b.light)}
            {toggle("dark", scheme, setScheme, Moon, b.dark)}
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={theme.data?.owned || theme.data?.is_free ? "/dashboard/design/theme" : `/dashboard/settings/billing/checkout?theme=${encodeURIComponent(themeKey)}`}>
            <ShoppingBag />
            {theme.data?.owned || theme.data?.is_free ? t.activate : t.buy}
          </Link>
        </Button>
      </header>
      <p className="bg-accent-soft/60 px-4 py-1.5 text-center text-xs text-ink-2">{b.note}</p>
      <div className="min-h-0 flex-1 overflow-hidden p-0 md:p-4">
        {/* The transform makes the frame hold the store's fixed parts (floating buttons, phone menu). */}
        <div className={cn("relative mx-auto h-full overflow-hidden bg-white shadow-sm transition-[width] [transform:translateZ(0)]", device === "mobile" ? "w-[390px] max-w-full rounded-[2rem] border-8 border-ink" : "w-full md:rounded-xl")}>
          <div className="h-full overflow-y-auto">
            <SufiStore design={SUFI_DEMO_DESIGN} data={SUFI_DEMO_DATA} storeName="صُوفي" mode="preview" scheme={scheme} />
          </div>
        </div>
      </div>
    </div>
  );
}
