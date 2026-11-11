"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive, Select as SelectPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { controlClass } from "./input";

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean; icon?: React.ReactNode };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Adds a first choice meaning "nothing / all" (value ""), e.g. «كل الحالات». */
  emptyLabel?: string;
  /** Search box above the list (long lists: governorates, products). Turns on by itself from 10 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

const NONE = "__none__";

const triggerClass = cn(controlClass, "flex h-9 items-center justify-between gap-2 px-3 text-start text-sm data-[placeholder]:text-ink-3");
const contentClass = "z-50 overflow-hidden rounded-lg border border-border bg-surface shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";
const itemClass =
  "relative flex select-none items-center gap-2 rounded-md py-2 pe-8 ps-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-surface-2 data-[selected=true]:bg-surface-2 data-[state=checked]:font-semibold";

/**
 * Styled select list (Radix Select: keyboard, typeahead, screen readers, RTL), with a search box
 * for long lists. Same look as the inputs; the chosen option gets a check.
 */
export function Select(props: Props) {
  const searchable = props.searchable ?? props.options.length >= 10;
  return searchable ? <SearchSelect {...props} /> : <PlainSelect {...props} />;
}

function PlainSelect({ value, onValueChange, options, placeholder, emptyLabel, id, disabled, invalid, className, ...rest }: Props) {
  const all = emptyLabel ? [{ value: NONE, label: emptyLabel }, ...options] : options;
  return (
    <SelectPrimitive.Root dir="rtl" value={value === "" ? (emptyLabel ? NONE : undefined) : value} onValueChange={(v) => onValueChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectPrimitive.Trigger id={id} aria-label={rest["aria-label"]} aria-invalid={invalid || undefined} className={cn(triggerClass, className)}>
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 shrink-0 text-ink-3" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} className={cn(contentClass, "max-h-72 min-w-[var(--radix-select-trigger-width)]")}>
          <SelectPrimitive.Viewport className="p-1">
            {all.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} className={itemClass}>
                {o.icon}
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.hint ? <span className="ms-auto text-xs text-ink-3">{o.hint}</span> : null}
                <SelectPrimitive.ItemIndicator className="absolute end-2.5">
                  <Check className="size-4 text-primary" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SearchSelect({ value, onValueChange, options, placeholder, emptyLabel, searchPlaceholder, id, disabled, invalid, className, ...rest }: Props) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const chosen = options.find((o) => o.value === value);
  const label = chosen?.label ?? (value === "" && emptyLabel ? emptyLabel : null);

  function pick(v: string) {
    onValueChange(v);
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button type="button" id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-label={rest["aria-label"]} aria-invalid={invalid || undefined} data-placeholder={label ? undefined : ""} className={cn(triggerClass, className)}>
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} className={cn(contentClass, "w-[var(--radix-popover-trigger-width)] min-w-56")}>
          <Command dir="rtl">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-ink-3" aria-hidden />
              <Command.Input autoFocus placeholder={searchPlaceholder ?? ar.common.search} className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
            </div>
            <Command.List id={listId} className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-xs text-ink-3">{ar.common.noResults}</Command.Empty>
              {emptyLabel ? (
                <Command.Item value={emptyLabel} onSelect={() => pick("")} className={itemClass}>
                  {emptyLabel}
                  {value === "" ? <Check className="absolute end-2.5 size-4 text-primary" /> : null}
                </Command.Item>
              ) : null}
              {options.map((o) => (
                <Command.Item key={o.value} value={`${o.label} ${o.hint ?? ""}`} disabled={o.disabled} onSelect={() => pick(o.value)} className={cn(itemClass, o.value === value && "font-semibold")}>
                  {o.icon}
                  {o.label}
                  {o.hint ? <span className="ms-auto text-xs text-ink-3">{o.hint}</span> : null}
                  {o.value === value ? <Check className="absolute end-2.5 size-4 text-primary" /> : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
