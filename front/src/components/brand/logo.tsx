import { useId } from "react";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * Temporary mark drawn in code from the owner's «مكسب» logo (orange bag with a rising bar chart).
 * Swap for the final SVG here only.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--logo-1)" />
          <stop offset="0.55" stopColor="var(--logo-2)" />
          <stop offset="1" stopColor="var(--logo-3)" />
        </linearGradient>
      </defs>
      <path d="M14 13V11a6 6 0 0 1 12 0v2" fill="none" stroke="var(--logo-3)" strokeWidth="3" strokeLinecap="round" />
      <path d="M8.5 13h23a2 2 0 0 1 2 1.8l1.6 19A2.5 2.5 0 0 1 32.6 36H7.4a2.5 2.5 0 0 1-2.5-2.2l1.6-19A2 2 0 0 1 8.5 13Z" fill={`url(#${id})`} />
      <rect x="11" y="26" width="4" height="5" rx="1" fill="#fff" />
      <rect x="18" y="23" width="4" height="8" rx="1" fill="#fff" />
      <rect x="25" y="19.5" width="4" height="11.5" rx="1" fill="#fff" />
    </svg>
  );
}

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {collapsed ? <span className="sr-only">{BRAND.name}</span> : <span className="font-display text-xl font-bold leading-none text-ink">{BRAND.name}</span>}
    </span>
  );
}
