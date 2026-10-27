"use client";

import { useState } from "react";
import type { PublicImage } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { Lightbox } from "./lightbox";
import { ResponsiveImage } from "./responsive-image";

/** Testimonial proof screenshot: small thumbnail that opens full size. */
export function ProofImage({ image, className, imageClassName }: { image: PublicImage; className?: string; imageClassName?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(0)} className={cn("block overflow-hidden", className)} aria-label={siteMessages.proof}>
        <ResponsiveImage image={image} sizes="(min-width: 768px) 33vw, 100vw" className={cn("w-full object-cover", imageClassName)} />
      </button>
      <Lightbox images={[image]} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
