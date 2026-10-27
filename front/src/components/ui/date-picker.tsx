"use client";

import { format, parse } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useId, useState } from "react";
import { DayPicker } from "react-day-picker";
import { arEG } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { inputClass } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const ISO = "yyyy-MM-dd";
const toDate = (value: string | undefined) => (value ? parse(value, ISO, new Date()) : undefined);

/** Month calendar in Arabic (RTL), styled with the platform tokens. */
export function Calendar(props: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      dir="rtl"
      locale={arEG}
      showOutsideDays
      components={{
        Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />),
      }}
      classNames={{
        root: "p-3 text-sm",
        months: "relative flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-9 items-center justify-center font-display font-semibold",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        button_previous: "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
        button_next: "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-[11px] font-medium text-muted-foreground",
        week: "mt-1 flex",
        day: "size-9 p-0 text-center",
        day_button:
          "size-9 rounded-lg tabular-nums transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:shadow-xs [&>button:hover]:bg-primary-hover",
        today: "[&>button]:font-bold [&>button]:text-primary [&>button]:ring-1 [&>button]:ring-primary/30",
        outside: "opacity-40",
        disabled: "opacity-30",
        hidden: "invisible",
      }}
      {...props}
    />
  );
}

/** Date field (value "YYYY-MM-DD" or "") with a calendar popover and a clear button. */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = ar.common.pickDate,
  className,
  "aria-label": ariaLabel,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const selected = toDate(value);
  const disabled = [...(min ? [{ before: toDate(min)! }] : []), ...(max ? [{ after: toDate(max)! }] : [])];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-controls={panelId}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "items-center gap-2 pe-9 text-start data-[state=open]:border-ring data-[state=open]:ring-4 data-[state=open]:ring-ring/15")}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className={cn("truncate", !selected && "text-muted-foreground/80")}>{selected ? format(selected, "d MMMM yyyy", { locale: arEG }) : placeholder}</span>
          </button>
        </PopoverTrigger>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={ar.common.clear}>
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent id={panelId} className="w-auto">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
          onSelect={(date) => {
            onChange(date ? format(date, ISO) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
