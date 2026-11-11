"use client";

import { Check, Plus, Search, Star } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { createCategory, useRefreshCategories, type Category } from "./api";

const t = ar.catalog;

/**
 * Pick several categories (tree order, indented) and star the main one. The first picked becomes
 * the main one until another is starred; unpicking the main one passes it to the next.
 * Typing a name that does not exist offers to create it right here.
 */
export function CategoryChecklist({
  categories,
  value,
  primary,
  onChange,
  max = 20,
}: {
  categories: Category[];
  value: number[];
  primary: number | null;
  onChange: (ids: number[], primary: number | null) => void;
  max?: number;
}) {
  const [q, setQ] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const refresh = useRefreshCategories();
  const term = q.trim().toLowerCase();
  const shown = term ? categories.filter((c) => c.name.toLowerCase().includes(term)) : categories;
  const exact = categories.some((c) => c.name.trim().toLowerCase() === term);

  function toggle(id: number) {
    if (value.includes(id)) {
      const ids = value.filter((v) => v !== id);
      onChange(ids, primary === id ? (ids[0] ?? null) : primary);
    } else if (value.length < max) {
      onChange([...value, id], primary ?? id);
    }
  }

  async function create() {
    setCreating(true);
    try {
      const category = await createCategory({ name: q.trim() });
      await refresh();
      onChange([...value, category.id], primary ?? category.id);
      setQ("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-border p-2">
        <InputGroup start={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar.common.searchShort} aria-label={ar.common.search} />
      </div>
      <ul className="max-h-64 overflow-y-auto overscroll-contain p-1" role="listbox" aria-multiselectable>
        {shown.map((c) => {
          const on = value.includes(c.id);
          const main = on && primary === c.id;
          return (
            <li key={c.id} className="flex items-center gap-1" style={{ paddingInlineStart: term ? 0 : `${c.depth * 1}rem` }}>
              <button type="button" role="option" aria-selected={on} onClick={() => toggle(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-start text-sm hover:bg-surface-2">
                <span className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors", on ? "border-primary bg-primary text-primary-ink" : "border-border-strong bg-surface")} aria-hidden>
                  {on ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className={cn("truncate", on && "font-semibold")}>{c.name}</span>
              </button>
              {on ? (
                <Tooltip content={main ? t.products.card.primaryHint : t.products.card.makePrimary}>
                  <button type="button" onClick={() => onChange(value, c.id)} aria-pressed={main} aria-label={main ? t.products.card.primary : t.products.card.makePrimary} className={cn("rounded-md p-1.5 transition-colors", main ? "text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}>
                    <Star className={cn("size-4", main && "fill-accent")} />
                  </button>
                </Tooltip>
              ) : null}
            </li>
          );
        })}
        {shown.length === 0 && !term ? <li className="px-3 py-6 text-center text-xs text-ink-3">{t.form.noCategories}</li> : null}
      </ul>
      {term && !exact ? (
        <div className="border-t border-border p-2">
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start" loading={creating} onClick={() => void create()}>
            <Plus />
            {t.form.createCategory}: «{q.trim()}»
          </Button>
        </div>
      ) : null}
    </div>
  );
}
