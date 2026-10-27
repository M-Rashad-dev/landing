import type { PublicImage } from "@/themes/types";

/** Above-the-fold image: high fetch priority, optional mobile art direction via <picture>. */
export function HeroPicture({ desktop, mobile, className, sizes }: { desktop: PublicImage; mobile: PublicImage | null; className?: string; sizes: string }) {
  return (
    <picture>
      {mobile ? <source media="(max-width: 767px)" srcSet={`${mobile.urls.medium} 800w, ${mobile.urls.large} 1600w`} sizes="100vw" /> : null}
      <img
        src={desktop.urls.large}
        srcSet={`${desktop.urls.medium} 800w, ${desktop.urls.large} 1600w`}
        sizes={sizes}
        width={desktop.width}
        height={desktop.height}
        alt={desktop.alt ?? ""}
        fetchPriority="high"
        loading="eager"
        className={className}
      />
    </picture>
  );
}
