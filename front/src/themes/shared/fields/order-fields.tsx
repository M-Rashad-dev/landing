"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BUILT_IN_FIELDS, CUSTOM_FIELD_TYPES, LOCKED_FIELDS, type BuiltInField, type BuiltInFieldConfig, type CustomField } from "@/themes/shared/schemas/order-form";
import { moveItem, newKey, useStableKeys } from "@/lib/hooks/use-stable-keys";
import { ar } from "@/messages/ar";
import type { FieldProps } from "./types";

const t = ar.sections.order_form;

/** The 7 built-in customer fields: enabled / required / label / placeholder (name & phone locked on). */
export function OrderFieldsField({ value, onChange, id }: FieldProps<Record<BuiltInField, BuiltInFieldConfig>>) {
  const fields = (value ?? {}) as Record<BuiltInField, BuiltInFieldConfig>;

  function patch(key: BuiltInField, change: Partial<BuiltInFieldConfig>) {
    onChange({ ...fields, [key]: { ...fields[key], ...change } });
  }

  return (
    <ul className="flex flex-col gap-2" id={id}>
      {BUILT_IN_FIELDS.map((key) => {
        const config = fields[key] ?? { enabled: false, required: false, label: t.builtIn[key], placeholder: "" };
        const locked = LOCKED_FIELDS.includes(key);
        return (
          <li key={key} className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t.builtIn[key]}</span>
              {locked ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" aria-hidden />
                  {t.alwaysOn}
                </span>
              ) : (
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <Switch checked={config.enabled} onCheckedChange={(enabled) => patch(key, { enabled, required: enabled ? config.required : false })} />
                    {t.fieldEnabled}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Switch checked={config.required} disabled={!config.enabled} onCheckedChange={(required) => patch(key, { required })} />
                    {t.fieldRequired}
                  </label>
                </div>
              )}
            </div>
            {config.enabled || locked ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input aria-label={t.fieldLabel} placeholder={t.fieldLabel} maxLength={60} value={config.label} onChange={(event) => patch(key, { label: event.target.value })} />
                <Input aria-label={t.fieldPlaceholder} placeholder={t.fieldPlaceholder} maxLength={100} value={config.placeholder} onChange={(event) => patch(key, { placeholder: event.target.value })} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Stable machine key from a label: latin slug when possible, else field_xxxx. */
export function customFieldKey(label: string, taken: string[]): string {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  let key = /^[a-z]/.test(base) ? base : `field_${Math.random().toString(36).slice(2, 6)}`;
  let n = 2;
  while (taken.includes(key)) key = `${key.replace(/_\d+$/, "")}_${n++}`;
  return key;
}

/** Up to 8 extra fields; the key is generated once and never changes. */
export function CustomFieldsField({ value, onChange, id, field }: FieldProps<CustomField[]> & { field: { max: number } }) {
  const items = Array.isArray(value) ? value : [];
  const [keys, setKeys] = useStableKeys(items.length);

  function update(index: number, change: Partial<CustomField>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...change } : item)));
  }

  function move(from: number, to: number) {
    setKeys(moveItem(keys, from, to));
    onChange(moveItem(items, from, to));
  }

  function add() {
    const label = `${t.custom.add} ${items.length + 1}`;
    setKeys([...keys, newKey()]);
    onChange([...items, { key: customFieldKey("", items.map((i) => i.key)), label, type: "text", required: false, placeholder: "", choices: [] }]);
  }

  function remove(index: number) {
    setKeys(keys.filter((_, i) => i !== index));
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2" id={id}>
      <SortableList
        items={items.map((item, index) => ({ item, key: keys[index] }))}
        getId={(row) => row.key}
        onMove={move}
        renderItem={({ item }, index, handle) => (
          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <DragHandle handle={handle} />
              <Input aria-label={t.fieldLabel} className="flex-1" maxLength={60} value={item.label} onChange={(event) => update(index, { label: event.target.value })} />
              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => remove(index)} aria-label={ar.fields.removeItem}>
                <Trash2 />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select aria-label={t.custom.type} value={item.type} onChange={(event) => update(index, { type: event.target.value as CustomField["type"] })} options={CUSTOM_FIELD_TYPES.map((type) => ({ value: type, label: t.custom.types[type] }))} />
              <Input aria-label={t.fieldPlaceholder} placeholder={t.fieldPlaceholder} maxLength={100} value={item.placeholder} onChange={(event) => update(index, { placeholder: event.target.value })} />
            </div>
            {item.type === "select" || item.type === "radio" ? (
              <div>
                <Textarea
                  aria-label={t.custom.choices}
                  rows={3}
                  placeholder={t.custom.choicesHint}
                  value={item.choices.join("\n")}
                  onChange={(event) => update(index, { choices: event.target.value.split("\n").map((c) => c.slice(0, 80)).slice(0, 20) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t.custom.choicesHint}</p>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                <Switch checked={item.required} onCheckedChange={(required) => update(index, { required })} />
                {t.fieldRequired}
              </label>
              <span dir="ltr" title={t.custom.keyHint}>
                {item.key}
              </span>
            </div>
          </div>
        )}
      />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={items.length >= field.max} onClick={add}>
        <Plus />
        {t.custom.add}
      </Button>
    </div>
  );
}
