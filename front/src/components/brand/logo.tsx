import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * The «مكسب» logo (owner's files in public/brand): the symbol alone, the horizontal logo (symbol + name),
 * and the vertical one. `light` turns it white for dark backgrounds.
 */
export function LogoMark({ size = 32, light = false, className }: { size?: number; light?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand file
    <img src="/brand/mksab-symbol.png" alt="" width={size} height={size} className={cn("shrink-0 object-contain", light && "brightness-0 invert", className)} aria-hidden />
  );
}

export function Logo({ collapsed = false, light = false, className }: { collapsed?: boolean; light?: boolean; className?: string }) {
  if (collapsed) {
    return (
      <span className={cn("flex items-center", className)}>
        <LogoMark light={light} />
        <span className="sr-only">{BRAND.name}</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand file
    <img src="/brand/mksab-horizontal.png" alt={BRAND.name} width={118} height={32} className={cn("h-8 w-auto max-w-none shrink-0 self-start object-contain", light && "brightness-0 invert", className)} />
  );
}

export function LogoVertical({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- small static brand file
  return <img src="/brand/mksab-vertical.png" alt={BRAND.name} width={100} height={80} className={cn("h-20 w-auto", className)} />;
}
