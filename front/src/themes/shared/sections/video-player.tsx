"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { embedUrl, posterUrl, type VideoSource } from "./video-url";

/**
 * Click-to-play: only a poster and a button until the visitor asks for the video, so the
 * page stays fast (no third-party player before the click).
 */
export function VideoPlayer({ source, poster, title, className }: { source: VideoSource; poster: string | null; title: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const image = poster ?? posterUrl(source);

  if (source.kind === "file") {
    return <video src={source.url} poster={image ?? undefined} controls playsInline preload="none" className={cn("aspect-video w-full bg-black object-contain", className)} />;
  }

  if (playing) {
    return <iframe src={embedUrl(source)} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className={cn("aspect-video w-full border-0 bg-black", className)} />;
  }

  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={siteMessages.blocks.playVideo} className={cn("group relative block aspect-video w-full overflow-hidden bg-black", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- merchant / YouTube poster, sizes unknown
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : null}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="t-primary flex size-20 items-center justify-center rounded-full shadow-[0_10px_40px_rgba(0,0,0,.35)] transition-transform duration-300 group-hover:scale-110">
          <Play className="ms-1 size-9 fill-current" aria-hidden />
        </span>
      </span>
    </button>
  );
}
