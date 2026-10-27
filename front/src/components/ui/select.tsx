"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { inputClass } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type SelectOption = { value: string; label: string; disabled?: boolean; hint?: string };

/** `e.target.value` like a native select, so callers keep `onChange={(e) => set(e.target.value)}`. */
export type SelectChange = { target: { value: string; name?: string } };

type SelectProps = {
  options: readonly SelectOption[];
  value?: string;
  onChange?: (event: SelectChange) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Show a search box. Defaults to on when there are more than 7 options. */
  searchable?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Select built on Radix Popover + cmdk: type-to-search, keyboard (arrows, Enter, Esc),
 * animated panel, check mark on the current value. A hidden input carries the value for forms.
 */
export function Select({
  options,
  value = "",
  onChange,
  onBlur,
  placeholder,
  searchable,
  id,
  name,
  disabled,
  required,
  className,
  ...aria
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const all = React.useMemo(() => (placeholder !== undefined ? [{ value: "", label: placeholder }, ...options] : options), [options, placeholder]);
  const selected = all.find((option) => option.value === value);
  const withSearch = searchable ?? options.length > 7;

  const pick = (next: string) => {
    setOpen(false);
    if (next !== value) onChange?.({ target: { value: next, name } });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-required={required || undefined}
          {...aria}
          className={cn(inputClass, "items-center justify-between gap-2 text-start data-[state=open]:border-ring data-[state=open]:ring-4 data-[state=open]:ring-ring/15", className)}
        >
          <span className={cn("truncate", (!selected || selected.value === "") && "text-muted-foreground/80")}>{selected?.label ?? placeholder ?? ""}</span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <PopoverContent id={listId} className="w-[var(--radix-popover-trigger-width)] min-w-48">
        <Command
          loop
          filter={(itemValue, search) => (normalize(itemValue).includes(normalize(search)) ? 1 : 0)}
          className="flex max-h-72 flex-col"
        >
          {withSearch ? (
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Command.Input autoFocus placeholder={ar.common.searchPlaceholder} className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" />
            </div>
          ) : null}
          <Command.List className="overflow-y-auto overscroll-contain p-1">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">{ar.common.noResults}</Command.Empty>
            {all.map((option) => (
              <Command.Item
                key={option.value || "__empty"}
                value={`${option.label} ${option.hint ?? ""} ${option.value}`}
                disabled={option.disabled}
                onSelect={() => pick(option.value)}
                className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent"
              >
                <Check className={cn("size-4 shrink-0 text-primary", option.value === value ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint ? <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span> : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Arabic-friendly matching: ignore case, diacritics and alef / yaa / taa marbuta variants. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}
