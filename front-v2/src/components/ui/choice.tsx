"use client";

import { Check, ChevronDown, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { controlClass } from "./input";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** Native select (fast, accessible, mobile-friendly) styled like the other controls. */
export function Select({ options, placeholder, className, ...props }: React.ComponentProps<"select"> & { options: SelectOption[]; placeholder?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(controlClass, "h-9 appearance-none pe-9 ps-3 text-sm")} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border-strong bg-surface transition-colors hover:border-ink-3 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-primary-ink">{props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}</CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** RTL switch: off = thumb on the start (right), on = green track with the thumb on the end (left). */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-border-strong transition-colors data-[state=checked]:bg-success disabled:opacity-45", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-[-2px] rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[-18px]" />
    </SwitchPrimitive.Root>
  );
}

/** A switch with its title and one-line explanation, the whole row clickable. */
export function SwitchRow({ title, description, checked, onCheckedChange, disabled }: { title: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {description ? <span className="block text-xs text-ink-3">{description}</span> : null}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}

/** Choice between a few options shown as cards (period, plan, store kind...). */
export function RadioCards({
  value,
  onValueChange,
  options,
  className,
  name,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Array<{ value: string; title: string; description?: string; meta?: React.ReactNode; disabled?: boolean }>;
  className?: string;
  name?: string;
}) {
  return (
    <RadioPrimitive.Root value={value} onValueChange={onValueChange} name={name} className={cn("grid gap-2 sm:grid-cols-2", className)} dir="rtl">
      {options.map((o) => (
        <RadioPrimitive.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-3 text-start transition-colors hover:border-ink-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand-soft/60 disabled:opacity-45"
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface [[data-state=checked]_&]:border-brand">
            <RadioPrimitive.Indicator className="size-2 rounded-full bg-brand" />
          </span>
          <span className="flex-1">
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
              {o.title}
              {o.meta}
            </span>
            {o.description ? <span className="mt-0.5 block text-xs text-ink-3">{o.description}</span> : null}
          </span>
        </RadioPrimitive.Item>
      ))}
    </RadioPrimitive.Root>
  );
}
