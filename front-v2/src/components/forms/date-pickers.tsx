"use client";

import { addDays, endOfMonth, endOfWeek, format, isValid, parse, startOfMonth, startOfWeek, startOfYear, subMonths, subWeeks } from "date-fns";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";
import { DayPicker, type DateRange as DayRange } from "react-day-picker";
import { arEG } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.common.dates;
const DAY = "yyyy-MM-dd";

/** Weeks start on Saturday (Egypt). */
const WEEK = { weekStartsOn: 6 as const };

const toDate = (s: string) => {
  const d = parse(s.slice(0, 10), DAY, new Date());
  return isValid(d) ? d : undefined;
};
const toText = (d: Date) => format(d, DAY);
const pretty = (d: Date) => format(d, "d MMM yyyy", { locale: arEG }).replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));

function Calendar(props: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker dir="rtl" locale={arEG} numerals="latn" weekStartsOn={6} showOutsideDays className="mk-calendar" {...props} />;
}

function Trigger({ label, placeholder, open, id, invalid, className, prefix }: { label: string | null; placeholder: string; open: boolean; id?: string; invalid?: boolean; className?: string; prefix?: string }) {
  return (
    <PopoverPrimitive.Trigger asChild>
      <button type="button" id={id} aria-expanded={open} className={cn(controlClass, "flex h-9 items-center gap-2 px-3 text-start text-sm", invalid && "border-danger", className)}>
        <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden />
        {prefix ? <span className="text-ink-3">{prefix}:</span> : null}
        <span className={cn("tabular flex-1 truncate", !label && "text-ink-3")}>{label ?? placeholder}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
    </PopoverPrimitive.Trigger>
  );
}

const contentClass = "z-50 rounded-xl border border-border bg-surface shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

/**
 * One date ("YYYY-MM-DD"), or a date and time ("YYYY-MM-DDTHH:mm", Cairo wall time) with `withTime`.
 */
export function DatePicker({ value, onChange, withTime = false, placeholder = t.pickDate, id, invalid, className }: { value: string; onChange: (v: string) => void; withTime?: boolean; placeholder?: string; id?: string; invalid?: boolean; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const date = value ? toDate(value) : undefined;
  const time = value.length > 10 ? value.slice(11, 16) : "10:00";
  const [hour, minute] = time.split(":");
  const label = date ? `${pretty(date)}${withTime ? ` · ${time}` : ""}` : null;

  const set = (d: Date | undefined, h = hour, m = minute) => onChange(d ? (withTime ? `${toText(d)}T${h}:${m}` : toText(d)) : "");

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <Trigger label={label} placeholder={placeholder} open={open} id={id} invalid={invalid} className={cn("w-full sm:w-60", className)} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} collisionPadding={12} className={cn(contentClass, "p-3")} dir="rtl">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(d) => {
              set(d);
              if (!withTime && d) setOpen(false);
            }}
          />
          {withTime ? (
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
              <span className="text-xs font-semibold text-ink-3">{t.time}</span>
              <Select aria-label={t.hour} value={hour} onValueChange={(h) => set(date ?? new Date(), h, minute)} options={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => ({ value: h, label: h }))} searchable={false} className="w-20" />
              <span className="text-ink-3">:</span>
              <Select aria-label={t.minute} value={minute} onValueChange={(m) => set(date ?? new Date(), hour, m)} options={["00", "15", "30", "45"].map((m) => ({ value: m, label: m }))} className="w-20" />
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => set(undefined)}>
              {t.clear}
            </Button>
            <Button variant="outline" size="sm" onClick={() => set(new Date())}>
              {t.today}
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export type RangePreset = keyof typeof t.presets;
export type RangeValue = { from: string; to: string; preset: RangePreset | "custom" };

/** Presets resolved against today (local calendar day). "all" = no limits. */
export function presetRange(preset: RangePreset, today = new Date()): { from: string; to: string } {
  const d = (x: Date) => toText(x);
  switch (preset) {
    case "today":
      return { from: d(today), to: d(today) };
    case "yesterday":
      return { from: d(addDays(today, -1)), to: d(addDays(today, -1)) };
    case "thisWeek":
      return { from: d(startOfWeek(today, WEEK)), to: d(today) };
    case "lastWeek": {
      const prev = subWeeks(today, 1);
      return { from: d(startOfWeek(prev, WEEK)), to: d(endOfWeek(prev, WEEK)) };
    }
    case "last7":
      return { from: d(addDays(today, -6)), to: d(today) };
    case "last30":
      return { from: d(addDays(today, -29)), to: d(today) };
    case "thisMonth":
      return { from: d(startOfMonth(today)), to: d(today) };
    case "lastMonth": {
      const prev = subMonths(today, 1);
      return { from: d(startOfMonth(prev)), to: d(endOfMonth(prev)) };
    }
    case "thisYear":
      return { from: d(startOfYear(today)), to: d(today) };
    case "all":
      return { from: "", to: "" };
  }
}

/**
 * Report period: ready presets on one side, a calendar for a custom range on the other,
 * applied with one button (nothing changes until «تطبيق»).
 */
export function DateRangePicker({ value, onChange, className }: { value: RangeValue; onChange: (v: RangeValue) => void; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<RangeValue>(value);
  const presets = Object.keys(t.presets) as RangePreset[];

  const label = value.preset !== "custom" ? t.presets[value.preset] : value.from && value.to ? `${pretty(toDate(value.from)!)} ← ${pretty(toDate(value.to)!)}` : null;
  const selected: DayRange | undefined = draft.from ? { from: toDate(draft.from), to: draft.to ? toDate(draft.to) : undefined } : undefined;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <Trigger label={label} placeholder={t.pickRange} open={open} prefix={t.range} className={cn("w-auto", className)} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} collisionPadding={12} className={cn(contentClass, "flex max-w-[calc(100vw-2rem)] flex-col sm:flex-row")} dir="rtl">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-44 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-e">
            {presets.map((p) => {
              const on = draft.preset === p;
              return (
                <li key={p} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...presetRange(p), preset: p })}
                    className={cn("flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors", on ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
                  >
                    {t.presets[p]}
                    {on ? <Check className="size-4" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col p-3">
            <p className="mb-1 text-xs font-semibold text-ink-3">{t.custom}</p>
            <Calendar
              mode="range"
              selected={selected}
              defaultMonth={selected?.from}
              onSelect={(r) => setDraft({ from: r?.from ? toText(r.from) : "", to: r?.to ? toText(r.to) : "", preset: "custom" })}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="tabular text-xs text-ink-3" dir="ltr">
                {draft.from || "—"} → {draft.to || "—"}
              </span>
              <Button
                size="sm"
                disabled={draft.preset === "custom" && !(draft.from && draft.to)}
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                {t.apply}
              </Button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
