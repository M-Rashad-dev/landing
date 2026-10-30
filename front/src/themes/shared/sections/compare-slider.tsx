"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

/**
 * Before / after with a draggable divider. A native range input drives it, so it works with
 * touch, mouse and the keyboard. Laid out left-to-right: before on the left, after on the right.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  chipClassName,
  className,
}: {
  before: { src: string; alt: string };
  after: { src: string; alt: string };
  beforeLabel: string;
  afterLabel: string;
  chipClassName: string;
  className?: string;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div dir="ltr" className={cn("relative aspect-[4/3] w-full select-none overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- stacked comparison images */}
      <img src={after.src} alt={after.alt} className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- stacked comparison images */}
        <img src={before.src} alt={before.alt} className="absolute inset-0 size-full object-cover" draggable={false} />
      </div>
      {beforeLabel ? <span className={cn("absolute start-3 top-3", chipClassName)}>{beforeLabel}</span> : null}
      {afterLabel ? <span className={cn("absolute end-3 top-3", chipClassName)}>{afterLabel}</span> : null}
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,.4)]" style={{ left: `${position}%` }}>
        <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={siteMessages.blocks.compareSlider}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
