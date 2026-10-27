"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * CSS scroll-snap slider with previous/next buttons and dots. No library.
 * Autoplay respects prefers-reduced-motion and pauses on hover/focus.
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
  const track = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      const el = track.current;
      if (!el || slides.length === 0) return;
      const target = (next + slides.length) % slides.length;
      const child = el.children[target] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    },
    [slides.length],
  );

  // Track the visible slide.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const i = Array.from(el.children).indexOf(entry.target);
            if (i >= 0) {
              setIndex(i);
              onIndexChange?.(i);
            }
          }
        }
      },
      { root: el, threshold: [0.6] },
    );
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [slides.length, onIndexChange]);

  useEffect(() => {
    if (controlledIndex !== undefined && controlledIndex !== index) goTo(controlledIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to external index changes
  }, [controlledIndex]);

  useEffect(() => {
    if (!autoplay || paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => goTo(index + 1), 4500);
    return () => clearInterval(timer);
  }, [autoplay, paused, index, goTo, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("relative", className)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} aria-roledescription="carousel">
      <div ref={track} className="t-scroll-snap flex gap-4 overflow-x-auto" tabIndex={0}>
        {slides.map((slide, i) => (
          <div key={i} className={cn("w-full shrink-0", slideClassName)} aria-roledescription="slide" aria-label={ar.site.slide(i + 1, slides.length)}>
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <>
          <button type="button" onClick={() => goTo(index - 1)} aria-label={ar.site.previous} className={cn("absolute start-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow", buttonClassName)}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => goTo(index + 1)} aria-label={ar.site.next} className={cn("absolute end-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow", buttonClassName)}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          {showDots ? (
            <div className="mt-3 flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <button key={i} type="button" onClick={() => goTo(i)} aria-label={ar.site.slide(i + 1, slides.length)} aria-current={i === index} className={dotClassName ? dotClassName(i === index) : cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-[var(--c-primary)]" : "w-2 bg-[var(--c-border)]")} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
