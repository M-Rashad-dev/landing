"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { ar } from "@/messages/ar";

/** Date (calendar) + time in Cairo wall time. Value: "YYYY-MM-DDTHH:mm" or "". */
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
  const [date = "", time = ""] = value ? value.split("T") : [];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <DatePicker id={id} value={date} invalid={invalid} placeholder={emptyLabel} className="min-w-0 flex-1" onChange={(next) => onChange(next ? `${next}T${time || "00:00"}` : "")} />
        <Input
          type="time"
          dir="ltr"
          aria-label={ar.common.time}
          value={time}
          disabled={!date}
          onChange={(event) => onChange(date ? `${date}T${event.target.value || "00:00"}` : "")}
          className="w-28 shrink-0 text-center tabular-nums"
        />
      </div>
      <span className="text-xs text-muted-foreground">{value ? ar.promotions.cairoTime : emptyLabel}</span>
    </div>
  );
}
