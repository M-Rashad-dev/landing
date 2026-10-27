"use client";

import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

/** Side panel. side="start" slides in from the right in RTL. */
export function SheetContent({
  className,
  children,
  side = "start",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "start" | "end" | "bottom" }) {
  const sides = {
    // RTL: "start" is the right edge.
    start: "inset-y-0 start-0 h-full w-[85%] max-w-sm border-e data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
    end: "inset-y-0 end-0 h-full w-[85%] max-w-sm border-s data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  };
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-[#12152a]/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        dir="rtl"
        className={cn(
          "fixed z-50 flex flex-col overflow-y-auto bg-card shadow-lg focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:ease-[var(--ease-out)]",
          sides[side],
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute end-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">{ar.common.close}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
