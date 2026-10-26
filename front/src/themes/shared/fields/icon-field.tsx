"use client";

import { Ban } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { ICON_KEYS } from "@/themes/shared/icons";
import { IconView } from "@/themes/shared/icon-view";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { FieldProps } from "./types";

export function IconField({ value, onChange, id }: FieldProps<string>) {
  const [open, setOpen] = useState(false);
  const hasIcon = Boolean(value && ICON_KEYS.includes(value));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button id={id} type="button" className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm">
          {hasIcon ? <IconView name={value} className="size-5 text-primary" /> : <Ban className="size-5 text-muted-foreground" aria-hidden />}
          <span className="text-muted-foreground">{hasIcon ? ar.fields.chooseIcon : ar.fields.noIcon}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content dir="rtl" align="start" sideOffset={6} className="z-50 grid w-72 grid-cols-8 gap-1 rounded-xl border bg-card p-2 shadow-lg">
          <button type="button" onClick={() => (onChange(""), setOpen(false))} className="flex size-8 items-center justify-center rounded-md hover:bg-accent" aria-label={ar.fields.noIcon}>
            <Ban className="size-4 text-muted-foreground" />
          </button>
          {ICON_KEYS.map((key) => {
            return (
              <button
                key={key}
                type="button"
                onClick={() => (onChange(key), setOpen(false))}
                aria-label={key}
                aria-pressed={value === key}
                className={cn("flex size-8 items-center justify-center rounded-md hover:bg-accent", value === key && "bg-secondary text-primary")}
              >
                <IconView name={key} className="size-4" />
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
