"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  className,
  buttonClassName,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)} role="group" aria-label={ar.site.quantity}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label={ar.site.decrease} className={cn("flex size-10 items-center justify-center disabled:opacity-40", buttonClassName)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <output className="min-w-10 text-center text-lg font-bold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label={ar.site.increase} className={cn("flex size-10 items-center justify-center disabled:opacity-40", buttonClassName)}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
