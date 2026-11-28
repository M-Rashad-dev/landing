"use client";

import * as React from "react";
import type { SpecFacet } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.storefront.list;
const SHOWN = 6;

/**
 * Spec filters of a store list (docs/plans/tekno/PLAN.md §2.1), for every theme's filter panel: one group of check
 * boxes per label with each value's product count, «امسح المواصفات». Values the visitor chose stay listed even
 * when the list no longer has them. Colors come from the theme (as- classes); `className` sets the box.
 */
export function SpecFilters({
  facets,
  chosen,
  onToggle,
  onClear,
  className,
}: {
  facets: SpecFacet[] | undefined;
  chosen: Record<string, string[]>;
  onToggle: (label: string, value: string, on: boolean) => void;
  onClear: () => void;
  className?: string;
}) {
  const groups = mergeChosen(facets ?? [], chosen);
  if (groups.length === 0) return null;
  const any = Object.values(chosen).some((v) => v.length > 0);

  return (
    <div className={cn("flex flex-col gap-3", className)} aria-label={t.specs} role="group">
      <div className="flex items-center justify-between gap-2">
        <p className="as-sm font-bold">{t.specs}</p>
        {any ? (
          <button type="button" onClick={onClear} className="as-xs font-bold text-(--as-primary) hover:underline">
            {t.specClear}
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 @3xl:grid-cols-3 @5xl:grid-cols-4">
        {groups.map((facet) => (
          <FacetGroup key={facet.label} facet={facet} chosen={chosen[facet.label] ?? []} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

function FacetGroup({ facet, chosen, onToggle }: { facet: SpecFacet; chosen: string[]; onToggle: (label: string, value: string, on: boolean) => void }) {
  const [all, setAll] = React.useState(false);
  const extra = facet.values.length - SHOWN;
  const values = all || extra <= 0 ? facet.values : facet.values.slice(0, SHOWN);
  const id = React.useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="as-sm mb-1 font-bold as-muted">{facet.label}</legend>
      {values.map((v) => {
        const on = chosen.includes(v.value);
        return (
          <label key={v.value} className="as-sm flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={on} onChange={(e) => onToggle(facet.label, v.value, e.target.checked)} className="size-4 shrink-0 accent-(--as-primary)" aria-describedby={`${id}-${v.value}`} />
            <bdi className="min-w-0 truncate">{v.value}</bdi>
            <span id={`${id}-${v.value}`} className="as-xs as-muted">
              {t.specCount(v.count)}
            </span>
          </label>
        );
      })}
      {extra > 0 ? (
        <button type="button" onClick={() => setAll((x) => !x)} className="as-xs self-start font-bold text-(--as-primary) hover:underline">
          {all ? t.specLess : t.specMore(extra)}
        </button>
      ) : null}
    </fieldset>
  );
}

/** The list's facets plus the chosen values it doesn't have any more (count 0), so they can be turned off. */
function mergeChosen(facets: SpecFacet[], chosen: Record<string, string[]>): SpecFacet[] {
  const out = facets.map((f) => ({ ...f, values: [...f.values] }));
  for (const [label, values] of Object.entries(chosen)) {
    let facet = out.find((f) => f.label.trim().toLowerCase() === label.trim().toLowerCase());
    if (!facet) {
      facet = { label, values: [] };
      out.push(facet);
    }
    for (const value of values) {
      if (!facet.values.some((v) => v.value.toLowerCase() === value.toLowerCase())) facet.values.push({ value, count: 0 });
    }
  }
  return out.filter((f) => f.values.length > 0);
}
