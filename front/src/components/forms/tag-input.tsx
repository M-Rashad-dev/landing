"use client";

import { X } from "lucide-react";
import * as React from "react";
import { controlClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Words as chips (keywords, tags): Enter or comma adds, Backspace on an empty field removes the
 * last, duplicates are ignored. `ghost` = chips shown faded while the list is empty (automatic values).
 */
export function TagInput({
  value,
  onChange,
  max = 10,
  maxLength = 40,
  placeholder,
  ghost,
  removeLabel,
  id,
  invalid,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  ghost?: string[];
  removeLabel: (word: string) => string;
  id?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const words = raw
      .split(/[,،\n]/)
      .map((w) => w.trim().slice(0, maxLength))
      .filter(Boolean);
    const next = [...value];
    for (const w of words) if (next.length < max && !next.some((n) => n.toLowerCase() === w.toLowerCase())) next.push(w);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  const showGhost = value.length === 0 && !draft && ghost?.length;

  return (
    <div
      className={cn(controlClass, "flex min-h-9 cursor-text flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/15", invalid && "border-danger")}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((word) => (
        <span key={word} className="inline-flex items-center gap-1 rounded-md bg-brand-soft py-0.5 ps-2 pe-1 text-xs font-semibold text-brand-strong">
          {word}
          <button type="button" onClick={() => onChange(value.filter((w) => w !== word))} className="rounded p-0.5 hover:bg-brand/20" aria-label={removeLabel(word)}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {showGhost
        ? ghost!.map((word) => (
            <span key={word} className="rounded-md border border-dashed border-border-strong px-2 py-0.5 text-xs text-ink-3">
              {word}
            </span>
          ))
        : null}
      {value.length < max ? (
        <input
          ref={inputRef}
          id={id}
          value={draft}
          maxLength={maxLength}
          onChange={(e) => (/[,،]/.test(e.target.value) ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length === 0 && !showGhost ? placeholder : undefined}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-ink-3"
        />
      ) : null}
    </div>
  );
}
