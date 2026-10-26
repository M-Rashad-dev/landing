"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ar } from "@/messages/ar";

/** datetime-local input in Cairo wall time (value: "YYYY-MM-DDTHH:mm" or ""). */
export function DateTimeField({
  id,
  value,
  onChange,
  invalid,
  emptyLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input id={id} type="datetime-local" dir="ltr" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid} className="text-start" />
        {value ? (
          <button type="button" onClick={() => onChange("")} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label={emptyLabel}>
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">{value ? ar.promotions.cairoTime : emptyLabel}</span>
    </div>
  );
}
