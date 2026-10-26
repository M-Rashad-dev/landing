"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Collapsible card section for long forms. */
export function FormSection({
  title,
  description,
  defaultOpen = true,
  hasError = false,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  defaultOpen?: boolean;
  hasError?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = open || hasError;

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setOpen} className={cn("rounded-xl border bg-card", hasError && "border-destructive/50")}>
      <Collapsible.Trigger className="flex w-full items-center gap-3 px-5 py-4 text-start focus-visible:outline-2 focus-visible:outline-ring">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
      </Collapsible.Trigger>
      <Collapsible.Content className="flex flex-col gap-4 border-t px-5 py-5">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
