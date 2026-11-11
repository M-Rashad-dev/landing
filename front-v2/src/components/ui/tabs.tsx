"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CountBadge } from "./badge";

export const Tabs = (props: React.ComponentProps<typeof TabsPrimitive.Root>) => <TabsPrimitive.Root dir="rtl" {...props} />;
export const TabsContent = TabsPrimitive.Content;

/** Underline tabs: the page sections (orders: all / new / confirmed...). */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-1 overflow-x-auto border-b border-border", className)} {...props} />;
}

export function TabsTrigger({ className, count, children, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 pb-2.5 pt-1.5 text-sm font-semibold text-ink-3 transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? <CountBadge value={count} /> : null}
    </TabsPrimitive.Trigger>
  );
}

/** Segmented control: small switches of view or period (7 / 30 / 90 days). */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; className?: string }) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("h-8 rounded-md px-3 text-[13px] font-semibold transition-colors", o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
