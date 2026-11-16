import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * The «مكسب» logo (owner's files in public/brand, SVG): the symbol (green box with the m), the horizontal logo
 * (name + symbol) and the vertical one. `light` swaps in the version drawn for dark backgrounds.
 */
export function LogoMark({ size = 32, light = false, className }: { size?: number; light?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand file
    <img src={light ? "/brand/mksab-symbol-on-dark.svg" : "/brand/mksab-symbol.svg"} alt="" width={size} height={size} className={cn("shrink-0 object-contain", className)} aria-hidden />
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
    <img src={light ? "/brand/mksab-horizontal-on-dark.svg" : "/brand/mksab-horizontal.svg"} alt={BRAND.name} width={92} height={40} className={cn("h-10 w-auto max-w-none shrink-0 self-start object-contain", className)} />
  );
}

export function LogoVertical({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- small static brand file
  return <img src="/brand/mksab-vertical.svg" alt={BRAND.name} width={55} height={80} className={cn("h-20 w-auto", className)} />;
}
