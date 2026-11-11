"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { controlClass } from "./input";

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean; icon?: React.ReactNode };

type Common = {
  options: SelectOption[];
  placeholder?: string;
  /** Search row at the top of the list. Default: on from 6 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * One dropdown for every choice in the dashboard (single and multiple), same look everywhere:
 * the field turns green while open, the list opens under it with a search row, a check marks
 * the chosen option (single) or each row has a checkbox (multiple). Keyboard: arrows, Enter, Esc, typing searches.
 */
export function Select({ value, onValueChange, emptyLabel, ...props }: Common & { value: string; onValueChange: (value: string) => void; emptyLabel?: string }) {
  const [open, setOpen] = React.useState(false);
  const chosen = props.options.find((o) => o.value === value);
  const label = chosen?.label ?? (value === "" && emptyLabel ? emptyLabel : null);
  const all = emptyLabel ? [{ value: "", label: emptyLabel }, ...props.options] : props.options;

  return (
    <Dropdown {...props} open={open} onOpenChange={setOpen} label={label}>
      {all.map((o) => {
        const on = o.value === value;
        return (
          <Row key={o.value || "__empty"} option={o} onSelect={() => (onValueChange(o.value), setOpen(false))} active={on}>
            {on ? <Check className="ms-auto size-4 shrink-0 text-primary" aria-hidden /> : null}
          </Row>
        );
      })}
    </Dropdown>
  );
}

/** Several choices; the field shows the chosen names (or how many when they do not fit). */
export function MultiSelect({ value, onChange, countLabel, ...props }: Common & { value: string[]; onChange: (value: string[]) => void; countLabel?: (n: number) => string }) {
  const [open, setOpen] = React.useState(false);
  const chosen = props.options.filter((o) => value.includes(o.value));
  const label = chosen.length === 0 ? null : chosen.length <= 2 || !countLabel ? chosen.map((o) => o.label).join("، ") : countLabel(chosen.length);

  return (
    <Dropdown {...props} open={open} onOpenChange={setOpen} label={label} multiple>
      {props.options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Row key={o.value} option={o} onSelect={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} active={false} checkbox={on}>
            {null}
          </Row>
        );
      })}
    </Dropdown>
  );
}

function Dropdown({
  options,
  placeholder,
  searchable,
  searchPlaceholder,
  id,
  disabled,
  invalid,
  className,
  open,
  onOpenChange,
  label,
  multiple = false,
  children,
  ...rest
}: Common & { open: boolean; onOpenChange: (open: boolean) => void; label: string | null; multiple?: boolean; children: React.ReactNode }) {
  const listId = React.useId();
  const withSearch = searchable ?? options.length >= 6;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={rest["aria-label"]}
          aria-invalid={invalid || undefined}
          className={cn(controlClass, "flex h-9 items-center justify-between gap-2 px-3 text-start text-sm", open && "border-primary ring-3 ring-primary/15", className)}
        >
          <span className={cn("truncate", !label && "text-ink-3")}>{label ?? placeholder}</span>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-180 text-primary")} aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-48 overflow-hidden rounded-lg border border-border bg-surface shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
          onOpenAutoFocus={(e) => {
            // Focus the search box (or the list) instead of the first row.
            if (!withSearch) e.preventDefault();
          }}
        >
          <Command dir="rtl" loop>
            {withSearch ? (
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
                <Command.Input autoFocus placeholder={searchPlaceholder ?? ar.common.searchShort} className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
              </div>
            ) : null}
            <Command.List id={listId} aria-multiselectable={multiple || undefined} className="max-h-60 overflow-y-auto overscroll-contain p-1">
              <Command.Empty className="px-3 py-6 text-center text-xs text-ink-3">{ar.common.noResults}</Command.Empty>
              {children}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function Row({ option, onSelect, active, checkbox, children }: { option: SelectOption; onSelect: () => void; active: boolean; checkbox?: boolean; children: React.ReactNode }) {
  return (
    <Command.Item
      value={`${option.label} ${option.hint ?? ""} ${option.value}`}
      disabled={option.disabled}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45 data-[selected=true]:bg-surface-2",
        active && "font-semibold text-ink",
      )}
    >
      {checkbox !== undefined ? (
        <span className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors", checkbox ? "border-primary bg-primary text-primary-ink" : "border-border-strong bg-surface")} aria-hidden>
          {checkbox ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      ) : null}
      {option.icon}
      <span className="truncate">{option.label}</span>
      {option.hint ? <span className="ms-auto shrink-0 text-xs text-ink-3">{option.hint}</span> : null}
      {children}
    </Command.Item>
  );
}
