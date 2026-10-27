"use client";

import { Check } from "lucide-react";
import { formatPrice } from "@/lib/price";
import type { PublicOption } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

export type OptionSelectorClasses = {
  root?: string;
  label?: string;
  button?: (selected: boolean) => string;
  swatch?: (selected: boolean) => string;
  select?: string;
  error?: string;
};

/** One product option as buttons, dropdown or color swatches (styling via classes). */
export function OptionSelector({
  option,
  value,
  onChange,
  error,
  classes = {},
  disabled,
}: {
  option: PublicOption;
  value: number | undefined;
  onChange: (valueId: number) => void;
  error?: string;
  classes?: OptionSelectorClasses;
  disabled?: boolean;
}) {
  const id = `opt-${option.id}`;
  const delta = (d: number) => (d > 0 ? ` (+${formatPrice(d)})` : "");
  const selectedLabel = option.values.find((v) => v.id === value)?.label;

  return (
    <fieldset className={cn("flex flex-col gap-2", classes.root)} disabled={disabled}>
      <legend className={cn("mb-2 text-sm font-semibold", classes.label)}>
        {option.name}
        {option.is_required ? <span className="text-red-600"> *</span> : null}
        {option.display_type === "swatch" && selectedLabel ? <span className="t-muted font-normal"> — {selectedLabel}</span> : null}
      </legend>

      {option.display_type === "dropdown" ? (
        <select id={id} value={value ?? ""} onChange={(event) => onChange(Number(event.target.value))} className={cn("t-input h-12 w-full rounded-lg px-3", classes.select)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}>
          <option value="" disabled>
            {siteMessages.chooseOption(option.name)}
          </option>
          {option.values.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
              {delta(v.price_delta)}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
          {option.values.map((v) => {
            const selected = v.id === value;
            return option.display_type === "swatch" ? (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${v.label}${delta(v.price_delta)}`}
                title={v.label}
                onClick={() => onChange(v.id)}
                className={classes.swatch ? classes.swatch(selected) : cn("relative flex size-10 items-center justify-center rounded-full border-2 ring-offset-2", selected ? "ring-2 ring-[var(--c-primary)]" : "")}
                style={{ background: v.color_hex ?? "#e5e7eb" }}
              >
                {selected ? <Check className="size-4 text-white mix-blend-difference" aria-hidden /> : null}
              </button>
            ) : (
              <button key={v.id} type="button" role="radio" aria-checked={selected} onClick={() => onChange(v.id)} className={classes.button ? classes.button(selected) : cn("min-h-11 rounded-lg border px-4 text-sm font-semibold", selected ? "t-primary border-transparent" : "t-border")}>
                {v.label}
                {v.price_delta > 0 ? <span className="ms-1 text-xs opacity-80">+{formatPrice(v.price_delta)}</span> : null}
              </button>
            );
          })}
        </div>
      )}
      {error ? (
        <p id={`${id}-error`} role="alert" className={cn("text-sm text-red-600", classes.error)}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
