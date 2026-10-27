"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Embla carousel: finger and mouse drag with momentum, smooth snapping, loop, RTL.
 * Several slides may be visible (slideClassName sets the width, e.g. `sm:basis-1/2`);
 * dots follow the snap points, not the slides. Autoplay pauses on hover / touch / focus
 * and is off for visitors who prefer reduced motion.
 */
export function Slider({
  children,
  autoplay = false,
  showDots = true,
  className,
  slideClassName,
  buttonClassName,
  dotClassName,
  onIndexChange,
  index: controlledIndex,
}: {
  children: ReactNode;
  autoplay?: boolean;
  showDots?: boolean;
  className?: string;
  slideClassName?: string;
  buttonClassName?: string;
  dotClassName?: (active: boolean) => string;
  onIndexChange?: (index: number) => void;
  index?: number;
}) {
  const slides = Children.toArray(children);
  const multiple = slides.length > 1;
  const [emblaRef, embla] = useEmblaCarousel(
    { direction: "rtl", loop: multiple, align: "start", containScroll: false, skipSnaps: false, duration: 28 },
    autoplay && multiple && !reducedMotion() ? [Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true })] : [],
  );
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  const sync = useCallback(() => {
    if (!embla) return;
    setSnaps(embla.scrollSnapList());
    const index = embla.selectedScrollSnap();
    setSelected(index);
    onIndexChange?.(index);
  }, [embla, onIndexChange]);

  useEffect(() => {
    if (!embla) return;
    const frame = requestAnimationFrame(sync);
    embla.on("select", sync).on("reInit", sync);
    return () => {
      cancelAnimationFrame(frame);
      embla.off("select", sync).off("reInit", sync);
    };
  }, [embla, sync]);

  // External control (gallery thumbnails).
  useEffect(() => {
    if (embla && controlledIndex !== undefined && controlledIndex !== embla.selectedScrollSnap()) embla.scrollTo(controlledIndex);
  }, [embla, controlledIndex]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("relative", className)} aria-roledescription="carousel">
      <div ref={emblaRef} className="overflow-hidden" tabIndex={0} onKeyDown={(event) => {
        // RTL: the right arrow goes to the previous slide.
        if (event.key === "ArrowRight") embla?.scrollPrev();
        if (event.key === "ArrowLeft") embla?.scrollNext();
      }}>
        <div className="-ms-4 flex touch-pan-y">
          {slides.map((slide, i) => (
            <div key={i} className={cn("min-w-0 shrink-0 grow-0 basis-full ps-4", slideClassName)} aria-roledescription="slide" aria-label={siteMessages.slide(i + 1, slides.length)}>
              {slide}
            </div>
          ))}
        </div>
      </div>
      {multiple ? (
        <>
          <button type="button" onClick={() => embla?.scrollPrev()} aria-label={siteMessages.previous} className={cn("absolute start-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow transition-transform hover:scale-105 active:scale-95", buttonClassName)}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => embla?.scrollNext()} aria-label={siteMessages.next} className={cn("absolute end-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow transition-transform hover:scale-105 active:scale-95", buttonClassName)}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          {showDots && snaps.length > 1 ? (
            <div className="mt-4 flex justify-center gap-1.5">
              {snaps.map((_, i) => (
                <button key={i} type="button" onClick={() => embla?.scrollTo(i)} aria-label={siteMessages.slide(i + 1, snaps.length)} aria-current={i === selected} className={dotClassName ? dotClassName(i === selected) : cn("h-2 rounded-full transition-all duration-300", i === selected ? "w-6 bg-[var(--c-primary)]" : "w-2 bg-[var(--c-border)]")} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
