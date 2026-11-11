import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "brand-soft" | "attention" | "success" | "warning" | "danger" | "info" | "ink";

const badge = cva("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-ink-2",
      brand: "bg-primary text-primary-ink",
      "brand-soft": "bg-brand-soft text-brand-strong",
      attention: "bg-accent-soft text-accent-ink",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      info: "bg-info-soft text-info",
      ink: "bg-ink text-ink-inverse",
    },
    size: { sm: "h-5 px-1.5 text-[11px]", md: "h-6 px-2 text-xs" },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

/** Small label. `dot` adds a status dot (live states: active, stopped, waiting). */
export function Badge({ className, tone, size, dot = false, children, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badge> & { dot?: boolean }) {
  return (
    <span className={cn(badge({ tone, size }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Round count for menus and tabs (0 hides it). */
export function CountBadge({ value, tone = "neutral", className }: { value: number; tone?: "neutral" | "attention" | "brand"; className?: string }) {
  if (value <= 0) return null;
  const tones = { neutral: "bg-surface-3 text-ink-2", attention: "bg-accent text-ink", brand: "bg-primary text-primary-ink" };
  return <span className={cn("tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold", tones[tone], className)}>{value > 99 ? "99+" : value}</span>;
}
