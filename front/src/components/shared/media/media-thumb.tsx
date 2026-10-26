import { ImageIcon } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Square thumbnail with lazy loading; falls back to an icon. */
export function MediaThumb({ media, className, size = "thumb" }: { media?: MediaItem | null; className?: string; size?: "thumb" | "medium" }) {
  if (!media) {
    return (
      <div className={cn("flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground", className)}>
        <ImageIcon className="size-6" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- media is served as static WebP by Caddy, next/image is not used
    <img
      src={media.urls[size]}
      alt={media.alt ?? media.name}
      width={media.width}
      height={media.height}
      loading="lazy"
      decoding="async"
      className={cn("aspect-square w-full rounded-lg bg-muted object-cover", className)}
    />
  );
}
