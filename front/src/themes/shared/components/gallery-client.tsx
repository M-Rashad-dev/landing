"use client";

import { useState } from "react";
import type { PublicImage } from "@/themes/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { Lightbox } from "./lightbox";
import { ResponsiveImage } from "./responsive-image";
import { Slider } from "./slider";

export type GalleryLayout = "slider" | "grid" | "thumbs-side" | "masonry";

/**
 * Interactive gallery shared by both themes (layout + class names differ).
 * Slider = scroll-snap with thumbnails; grid/masonry open the lightbox.
 */
export function GalleryClient({
  images,
  layout,
  autoplay,
  showThumbnails,
  lightbox,
  frameClassName,
  thumbClassName,
}: {
  images: PublicImage[];
  layout: GalleryLayout;
  autoplay: boolean;
  showThumbnails: boolean;
  lightbox: boolean;
  frameClassName?: string;
  thumbClassName?: (active: boolean) => string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState<number | undefined>(undefined);

  const zoom = (index: number) => (lightbox ? setOpen(index) : undefined);
  const thumbs =
    showThumbnails && images.length > 1 ? (
      <div className={cn("flex gap-2", layout === "thumbs-side" ? "md:order-first md:flex-col overflow-x-auto md:overflow-visible" : "mt-3 overflow-x-auto")}>
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setTarget(i)}
            aria-label={ar.site.slide(i + 1, images.length)}
            aria-current={current === i}
            className={thumbClassName ? thumbClassName(current === i) : cn("size-16 shrink-0 overflow-hidden rounded-xl border-2 sm:size-20", current === i ? "border-[var(--c-primary)]" : "border-transparent opacity-70")}
          >
            <ResponsiveImage image={image} sizes="80px" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    ) : null;

  const content =
    layout === "slider" || layout === "thumbs-side" ? (
      <div className={cn(layout === "thumbs-side" && "md:flex md:gap-4")}>
        <div className="min-w-0 flex-1">
          <Slider autoplay={autoplay} showDots={!showThumbnails} onIndexChange={setCurrent} index={target}>
            {images.map((image, i) => (
              <button key={image.id} type="button" onClick={() => zoom(i)} className={cn("block w-full overflow-hidden", frameClassName, !lightbox && "cursor-default")} aria-label={lightbox ? ar.site.openImage : undefined}>
                <ResponsiveImage image={image} sizes="(min-width: 1024px) 60vw, 100vw" className="aspect-square w-full object-cover md:aspect-[4/3]" />
              </button>
            ))}
          </Slider>
        </div>
        {thumbs}
      </div>
    ) : layout === "masonry" ? (
      <div className="columns-2 gap-3 md:columns-3">
        {images.map((image, i) => (
          <button key={image.id} type="button" onClick={() => zoom(i)} className={cn("mb-3 block w-full break-inside-avoid overflow-hidden", frameClassName)} aria-label={lightbox ? ar.site.openImage : undefined}>
            <ResponsiveImage image={image} sizes="(min-width: 768px) 33vw, 50vw" className="w-full" />
          </button>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {images.map((image, i) => (
          <button key={image.id} type="button" onClick={() => zoom(i)} className={cn("block overflow-hidden", frameClassName)} aria-label={lightbox ? ar.site.openImage : undefined}>
            <ResponsiveImage image={image} sizes="(min-width: 768px) 33vw, 50vw" className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-105" />
          </button>
        ))}
      </div>
    );

  return (
    <>
      {content}
      {lightbox ? <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
