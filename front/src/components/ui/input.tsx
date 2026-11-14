import * as React from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-lg border border-border-strong bg-surface text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/15";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-9 px-3 text-sm", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20 px-3 py-2 text-sm leading-relaxed", className)} {...props} />;
}

/**
 * An input with fixed text or icons on its sides (currency, "/products/", search icon).
 * `start` sits on the right in RTL, `end` on the left.
 */
export function InputGroup({
  start,
  end,
  className,
  inputClassName,
  ltr = false,
  ...props
}: React.ComponentProps<"input"> & { start?: React.ReactNode; end?: React.ReactNode; inputClassName?: string; ltr?: boolean }) {
  // `ltr`: numbers, money, phones — the whole group reads left-to-right (unit on the right).
  return (
    <div dir={ltr ? "ltr" : undefined} className={cn("group relative flex items-center", className)}>
      {start ? <span className="pointer-events-none absolute start-3 flex items-center text-sm text-ink-3 [&_svg]:size-4">{start}</span> : null}
      <input className={cn(controlClass, "h-9 text-sm", start ? "ps-9" : "ps-3", end ? "pe-14" : "pe-3", inputClassName)} {...props} />
      {end ? <span className="pointer-events-none absolute end-3 flex items-center text-xs font-semibold text-ink-3 [&_svg]:size-4">{end}</span> : null}
    </div>
  );
}

/** A fixed part glued before the field (e.g. "/products/" before a slug). */
export function AddonInput({ addon, className, ...props }: React.ComponentProps<"input"> & { addon: React.ReactNode }) {
  return (
    <div className={cn("flex items-stretch", className)} dir="ltr">
      <span className="flex items-center rounded-s-lg border border-e-0 border-border-strong bg-surface-2 px-3 text-sm text-ink-3">{addon}</span>
      <input className={cn(controlClass, "h-9 rounded-s-none px-3 text-sm")} {...props} />
    </div>
  );
}
