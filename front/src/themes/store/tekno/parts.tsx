"use client";

import { ImageOff, Star } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { useTekno } from "./root";

/** Picked images by id: the Builder's new picks first, else the design data. */
export function useImage(): (id: number | null | undefined) => MediaUrls | null {
  const { media, data } = useTekno();
  return (id) => (id ? (media[String(id)] ?? data.media[String(id)] ?? null) : null);
}

export function Photo({ urls, size = "large", alt = "", className }: { urls: MediaUrls | null | undefined; size?: "thumb" | "medium" | "large"; alt?: string; className?: string }) {
  const src = pick(urls ?? null, size);
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-(--tk-plate) text-slate-400", className)} role="img" aria-label={alt || ar.teknoStore.empty.photo}>
        <ImageOff className="size-8" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}

/** A section's kicker and title, with something at the end (tabs, «شوف الكل»…). */
export function Head({ kicker, title, text, end }: { kicker?: string | null; title?: string | null; text?: string | null; end?: React.ReactNode }) {
  if (!kicker && !title && !text && !end) return null;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {kicker ? <span className="tk-kicker">{kicker}</span> : null}
        {title ? <h2 className="tk-display tk-title">{title}</h2> : null}
        {text ? <p className="as-sm as-muted max-w-2xl leading-relaxed">{text}</p> : null}
      </div>
      {end}
    </div>
  );
}

/** Amber stars (filled up to the rounded average). */
export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("tk-stars inline-flex items-center gap-px", className)} role="img" aria-label={ar.storefront.reviews.outOf(value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3", n <= full ? "fill-current" : "opacity-40")} aria-hidden />
      ))}
    </span>
  );
}

/** «32,999 ج.م» in the title font. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <b className={cn("tk-price", className)}>{formatMoney(value)}</b>;
}

/** What the Builder shows for a section with nothing to show yet (nothing on the live store). */
export function Empty({ text }: { text: string }) {
  const { mode } = useTekno();
  if (mode !== "builder") return null;
  return <p className="as-sm m-4 rounded-2xl border-2 border-dashed p-6 text-center as-muted">{text}</p>;
}
