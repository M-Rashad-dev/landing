"use client";

import { siteMessages } from "@/messages/site";

const SORTS = ["newest", "price_asc", "price_desc", "best_sellers", "featured"] as const;

/** Sort dropdown that submits its filter form on change (the form still works without JS). */
export function SortSelect({ value, className }: { value: string; className: string }) {
  return (
    <select name="sort" defaultValue={value} aria-label={siteMessages.store.sort} className={className} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
      {SORTS.map((sort) => (
        <option key={sort} value={sort}>
          {siteMessages.store.sorts[sort]}
        </option>
      ))}
    </select>
  );
}
