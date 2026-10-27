"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PublicImage } from "@/themes/types";
import { siteMessages } from "@/messages/site";

/** Full-screen image viewer: Esc closes, arrow keys navigate (RTL aware). */
export function Lightbox({ images, index, onIndex, onClose }: { images: PublicImage[]; index: number | null; onIndex: (index: number) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (index === null) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      // RTL: right arrow = previous, left arrow = next.
      if (event.key === "ArrowRight") onIndex((index! - 1 + images.length) % images.length);
      if (event.key === "ArrowLeft") onIndex((index! + 1) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus();
    };
  }, [index, images.length, onClose, onIndex]);

  if (index === null || !images[index]) return null;
  const image = images[index];

  return (
    <div role="dialog" aria-modal="true" aria-label={siteMessages.openImage} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button ref={closeRef} type="button" onClick={onClose} aria-label={siteMessages.close} className="absolute end-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
        <X className="size-6" />
      </button>
      {images.length > 1 ? (
        <>
          <button type="button" onClick={(e) => (e.stopPropagation(), onIndex((index - 1 + images.length) % images.length))} aria-label={siteMessages.previous} className="absolute start-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25">
            <ChevronRight className="size-6" />
          </button>
          <button type="button" onClick={(e) => (e.stopPropagation(), onIndex((index + 1) % images.length))} aria-label={siteMessages.next} className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25">
            <ChevronLeft className="size-6" />
          </button>
        </>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- static WebP served by Caddy */}
      <img src={image.urls.large} alt={image.alt ?? ""} width={image.width} height={image.height} className="max-h-[88vh] w-auto max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <span className="absolute bottom-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white" dir="ltr">
        {index + 1} / {images.length}
      </span>
    </div>
  );
}
