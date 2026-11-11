"use client";

import { Check, Home, Package, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Badge, CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { PALETTE_STORAGE_KEY, PALETTES, type PaletteKey } from "@/config/palettes";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.showcase.palettes;

function currentPalette(): PaletteKey {
  if (typeof document === "undefined") return "naana";
  const p = document.documentElement.dataset.palette as PaletteKey | undefined;
  return p && (PALETTES as readonly string[]).includes(p) ? p : "naana";
}

/**
 * The three color identities side by side (each preview scopes its palette with data-palette),
 * and a button to try one on the whole dashboard (kept in this browser).
 */
export function PalettePicker() {
  const [active, setActive] = useState<PaletteKey>("naana");

  useEffect(() => {
    // Read the palette the boot script applied before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with a browser-only value
    setActive(currentPalette());
  }, []);

  function apply(key: PaletteKey) {
    document.documentElement.setAttribute("data-palette", key);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, key);
    } catch {
      // Storage blocked: the palette lasts for this visit.
    }
    setActive(key);
  }

  return (
    <section id="palettes" className="scroll-mt-24">
      <h2 className="text-xl font-bold">{t.title}</h2>
      <p className="mt-1 max-w-3xl text-[13px] text-ink-3">{t.description}</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {PALETTES.map((key) => (
          <PalettePreview key={key} palette={key} active={active === key} onApply={() => apply(key)} />
        ))}
      </div>
    </section>
  );
}

function PalettePreview({ palette, active, onApply }: { palette: PaletteKey; active: boolean; onApply: () => void }) {
  const info = t.items[palette];
  const s = t.sample;
  return (
    <article data-palette={palette} className={cn("flex flex-col overflow-hidden rounded-xl border-2 bg-bg text-ink", active ? "border-brand" : "border-border")}>
      {/* Mini dashboard */}
      <div className="flex min-h-56 border-b border-border">
        <div className="flex w-32 shrink-0 flex-col gap-1 border-e border-border bg-surface p-2">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <LogoMark size={22} />
            <span className="font-display text-sm font-bold">{BRAND.name}</span>
          </div>
          <span className="relative flex items-center gap-2 rounded-md bg-brand-soft px-2 py-1.5 text-[11px] font-semibold">
            <span className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-brand" />
            <Home className="size-3.5 text-brand-strong" />
            {s.menuHome}
          </span>
          <span className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-ink-2">
            <ShoppingBag className="size-3.5 text-ink-3" />
            <span className="flex-1">{s.menuOrders}</span>
            <CountBadge value={3} tone="attention" />
          </span>
          <span className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-ink-2">
            <Package className="size-3.5 text-ink-3" />
            {s.menuProducts}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-surface p-2">
              <p className="text-[10px] text-ink-3">{s.sales}</p>
              <p className="tabular font-display text-base font-semibold">4,820</p>
              <span className="tabular rounded bg-success-soft px-1 text-[10px] font-semibold text-success" dir="ltr">
                +12%
              </span>
            </div>
            <div className="rounded-lg border border-accent/60 bg-accent-soft/50 p-2">
              <p className="flex items-center gap-1 text-[10px] text-ink-2">
                <span className="size-1.5 rounded-full bg-accent" />
                {s.waiting}
              </p>
              <p className="tabular font-display text-base font-semibold">3</p>
            </div>
          </div>
          <div className="flex h-12 items-end gap-1 rounded-lg border border-border bg-surface p-2" aria-hidden>
            {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
              <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 5 ? "var(--chart-1)" : "var(--chart-2)", opacity: i === 5 ? 1 : 0.85 }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge tone="attention" size="sm" dot>
              {ar.domain.orderStatus.new}
            </Badge>
            <Badge tone="info" size="sm" dot>
              {ar.domain.orderStatus.confirmed}
            </Badge>
            <Badge tone="success" size="sm" dot>
              {ar.domain.orderStatus.delivered}
            </Badge>
            <Badge tone="danger" size="sm" dot>
              {ar.domain.orderStatus.fake}
            </Badge>
          </div>
          <div className="mt-auto flex gap-1.5">
            <Button size="sm">{s.save}</Button>
            <Button size="sm" variant="outline">
              {s.secondary}
            </Button>
            <Button size="sm" variant="link">
              {ar.common.viewAll}
            </Button>
          </div>
        </div>
      </div>
      {/* Swatches + story */}
      <div className="flex flex-1 flex-col gap-3 bg-surface p-4">
        <div className="flex h-7 overflow-hidden rounded-md" aria-hidden>
          {["--ink", "--primary", "--brand", "--accent", "--surface-2", "--bg"].map((v) => (
            <span key={v} className="flex-1" style={{ background: `var(${v})` }} />
          ))}
        </div>
        <div>
          <p className="font-display text-lg font-bold">{info.name}</p>
          <p className="text-xs font-semibold text-brand-strong">{info.tagline}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{info.story}</p>
        </div>
        <Button variant={active ? "secondary" : "primary"} className="mt-auto" onClick={onApply} disabled={active}>
          {active ? (
            <>
              <Check />
              {t.applied}
            </>
          ) : (
            t.apply
          )}
        </Button>
      </div>
    </article>
  );
}
