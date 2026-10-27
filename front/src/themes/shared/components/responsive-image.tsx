import type { PublicImage } from "@/themes/types";
import { cn } from "@/lib/utils";

/** WebP variants via srcset (320/800/1600) with intrinsic size to avoid layout shift. */
export function ResponsiveImage({
  image,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  className,
  alt,
}: {
  image: PublicImage;
  sizes?: string;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static WebP variants served by Caddy
    <img
      src={image.urls.large}
      srcSet={`${image.urls.thumb} 320w, ${image.urls.medium} 800w, ${image.urls.large} 1600w`}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt ?? ""}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-auto max-w-full", className)}
    />
  );
}
