"use client";

import { Images, LayoutGrid, MessageSquareQuote, Sparkles, type LucideIcon } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { SectionType } from "@/themes/asas/types";

const t = ar.design.builder;

export const SECTION_TYPES: SectionType[] = ["banner", "products", "features", "testimonials"];

/** One icon and one tint per section type, used in the list, the gallery and the canvas. */
export const SECTION_LOOK: Record<SectionType, { icon: LucideIcon; tint: string }> = {
  banner: { icon: Images, tint: "bg-violet-100 text-violet-700" },
  products: { icon: LayoutGrid, tint: "bg-emerald-100 text-emerald-700" },
  features: { icon: Sparkles, tint: "bg-amber-100 text-amber-700" },
  testimonials: { icon: MessageSquareQuote, tint: "bg-sky-100 text-sky-700" },
};

export function SectionIcon({ type, size = "md" }: { type: SectionType; size?: "sm" | "md" }) {
  const { icon: Icon, tint } = SECTION_LOOK[type];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", tint, size === "sm" ? "size-7" : "size-9")} aria-hidden>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

/** A small drawing of what the section looks like on the store. */
function Sketch({ type }: { type: SectionType }) {
  const line = "fill-ink/15";
  const strong = "fill-ink/30";
  const accent = "fill-brand/70";
  return (
    <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden>
      <rect width="160" height="90" rx="6" className="fill-surface-2" />
      {type === "banner" ? (
        <>
          <rect x="10" y="10" width="140" height="70" rx="5" className="fill-ink/20" />
          <rect x="88" y="30" width="50" height="7" rx="2" className="fill-white/90" />
          <rect x="98" y="41" width="40" height="4" rx="2" className="fill-white/70" />
          <rect x="108" y="52" width="30" height="9" rx="3" className={accent} />
          <circle cx="76" cy="72" r="2" className="fill-white" />
          <circle cx="84" cy="72" r="2" className="fill-white/60" />
        </>
      ) : type === "products" ? (
        <>
          <rect x="100" y="10" width="50" height="6" rx="2" className={strong} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${10 + i * 36} 24)`}>
              <rect width="32" height="34" rx="3" className={line} />
              <rect y="38" width="26" height="4" rx="2" className={strong} />
              <rect y="45" width="16" height="4" rx="2" className={accent} />
              <rect y="52" width="32" height="7" rx="2" className={accent} />
            </g>
          ))}
        </>
      ) : type === "features" ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${12 + i * 36} 22)`}>
              <rect width="32" height="46" rx="4" className={line} />
              <circle cx="16" cy="15" r="7" className={accent} />
              <rect x="6" y="28" width="20" height="4" rx="2" className={strong} />
              <rect x="9" y="35" width="14" height="3" rx="1.5" className={line} />
            </g>
          ))}
        </>
      ) : (
        <>
          <rect x="100" y="10" width="50" height="6" rx="2" className={strong} />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${10 + i * 48} 24)`}>
              <rect width="44" height="54" rx="4" className={line} />
              {[0, 1, 2, 3, 4].map((s) => (
                <circle key={s} cx={30 - s * 5} cy="10" r="2" className="fill-amber-400" />
              ))}
              <rect x="6" y="18" width="32" height="3" rx="1.5" className={strong} />
              <rect x="6" y="24" width="28" height="3" rx="1.5" className={line} />
              <rect x="6" y="30" width="30" height="3" rx="1.5" className={line} />
              <rect x="20" y="42" width="18" height="4" rx="2" className={strong} />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

export function SectionGallery({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (type: SectionType) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title={t.galleryTitle} description={t.galleryHint} />
        <DialogBody>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECTION_TYPES.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => onPick(type)}
                  className="group flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-3 text-start transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:border-brand"
                >
                  <span className="block aspect-[16/9] overflow-hidden rounded-lg">
                    <Sketch type={type} />
                  </span>
                  <span className="flex items-start gap-2.5">
                    <SectionIcon type={type} size="sm" />
                    <span className="flex flex-col">
                      <span className="font-semibold">{t.types[type].title}</span>
                      <span className="text-xs text-ink-3">{t.types[type].description}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
