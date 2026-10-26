"use client";

import { Input } from "@/components/ui/input";
import { isHexColor } from "@/lib/color";
import { cn } from "@/lib/utils";

/** Native color picker + hex text box (#RRGGBB). */
export function ColorInput({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  allowEmpty = false,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  invalid?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const current = value ?? "";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-hidden
        tabIndex={-1}
        value={isHexColor(current) ? current.toLowerCase() : "#000000"}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className={cn("h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1", !isHexColor(current) && "opacity-50")}
      />
      <Input
        id={id}
        dir="ltr"
        value={current}
        placeholder={placeholder ?? "#RRGGBB"}
        maxLength={7}
        aria-invalid={invalid}
        className="font-mono uppercase"
        onChange={(event) => {
          const next = event.target.value.trim();
          onChange(next === "" && allowEmpty ? null : next.toUpperCase());
        }}
      />
    </div>
  );
}
