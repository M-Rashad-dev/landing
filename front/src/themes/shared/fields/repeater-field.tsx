"use client";

import { ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import type { FieldDef } from "@/themes/types";
import { insertAt, moveItem, newKey, useStableKeys } from "@/lib/hooks/use-stable-keys";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { FieldList } from "./field-renderer";
import type { FieldProps } from "./types";

type Item = Record<string, unknown>;
type RepeaterDef = Extract<FieldDef, { type: "repeater" }>;

/** Sortable list of items: add / duplicate / remove, collapsed titles, max items. */
export function RepeaterField({ field, value, onChange, ctx, id }: FieldProps<Item[], RepeaterDef>) {
  const items = Array.isArray(value) ? value : [];
  // Stable client keys for drag-and-drop (items have no ids in the stored JSON).
  const [keys, setKeys] = useStableKeys(items.length);
  const [open, setOpen] = useState<string | null>(null);
  const t = ar.fields;

  const rows = items.map((item, index) => ({ item, key: keys[index] }));

  function update(index: number, patch: Item) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(from: number, to: number) {
    setKeys(moveItem(keys, from, to));
    onChange(moveItem(items, from, to));
  }

  function add() {
    const key = newKey();
    setKeys([...keys, key]);
    onChange([...items, structuredClone(field.newItem)]);
    setOpen(key);
  }

  function duplicate(index: number) {
    setKeys(insertAt(keys, index + 1, newKey()));
    onChange(insertAt(items, index + 1, structuredClone(items[index])));
  }

  function remove(index: number) {
    setKeys(keys.filter((_, i) => i !== index));
    onChange(items.filter((_, i) => i !== index));
  }

  const full = items.length >= field.max;
  const atMin = items.length <= (field.min ?? 0);

  return (
    <div className="flex flex-col gap-2" id={id}>
      <SortableList
        items={rows}
        getId={(row) => row.key}
        onMove={move}
        renderItem={(row, index, handle) => {
          const title = field.titleField ? String(row.item[field.titleField] ?? "").trim() : "";
          const isOpen = open === row.key;
          return (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-1 p-1.5">
                <DragHandle handle={handle} />
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-start text-sm" onClick={() => setOpen(isOpen ? null : row.key)} aria-expanded={isOpen}>
                  <span className="truncate font-medium">{title || `${field.itemLabel} ${index + 1}`}</span>
                  <ChevronDown className={cn("ms-auto size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={full} onClick={() => duplicate(index)} aria-label={t.duplicateItem}>
                  <Copy />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" disabled={atMin} onClick={() => remove(index)} aria-label={t.removeItem}>
                  <Trash2 />
                </Button>
              </div>
              {isOpen ? (
                <div className="border-t p-3">
                  <FieldList fields={field.fields} values={row.item} onChange={(patch) => update(index, patch)} ctx={{ ...ctx, idPrefix: `${ctx.idPrefix}-${field.key}-${index}` }} />
                </div>
              ) : null}
            </div>
          );
        }}
      />
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={add}>
          <Plus />
          {t.addItem}
        </Button>
        <span className="text-xs text-muted-foreground">
          {items.length}/{field.max}
        </span>
      </div>
    </div>
  );
}
