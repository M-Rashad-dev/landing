import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = Omit<React.ComponentProps<"select">, "children"> & {
  options: readonly SelectOption[];
  placeholder?: string;
};

/** Native select: best keyboard + mobile behaviour, styled like the inputs. */
export function Select({ className, options, placeholder, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(inputClass, "appearance-none pe-9", className)} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}
