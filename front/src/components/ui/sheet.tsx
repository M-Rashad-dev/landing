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

/** Side panel. side="start" opens from the right in RTL. */
export function SheetContent({
  className,
  children,
  side = "start",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "start" | "end" | "bottom" }) {
  const sides = {
    start: "inset-y-0 start-0 h-full w-[85%] max-w-sm border-e",
    end: "inset-y-0 end-0 h-full w-[85%] max-w-sm border-s",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t",
  };
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <SheetPrimitive.Content
        dir="rtl"
        className={cn("fixed z-50 flex flex-col overflow-y-auto bg-card shadow-xl focus-visible:outline-none", sides[side], className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute end-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">{ar.common.close}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
