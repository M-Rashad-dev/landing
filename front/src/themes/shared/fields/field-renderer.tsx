"use client";

import { FormField } from "@/components/forms/form-field";
import { ColorInput } from "@/components/forms/color-input";
import { MediaField } from "@/components/shared/media-picker/media-field";
import { MediaListField } from "@/components/shared/media-picker/media-list-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDef } from "@/themes/types";
import { IconField } from "./icon-field";
import { LinkField } from "./link-field";
import { CustomFieldsField, OrderFieldsField } from "./order-fields";
import { RepeaterField } from "./repeater-field";
import type { FieldContext } from "./types";

/** Is a field visible given its sibling values (simple showIf)? */
export function isFieldVisible(field: FieldDef, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
}

/** Renders the form for a list of field definitions (a section's props or a repeater item). */
export function FieldList({
  fields,
  values,
  onChange,
  ctx,
}: {
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  ctx: FieldContext;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fields
        .filter((field) => isFieldVisible(field, values))
        .map((field) => (
          <FieldRenderer key={field.key} field={field} value={values[field.key]} onChange={(value) => onChange({ [field.key]: value })} ctx={ctx} />
        ))}
    </div>
  );
}

export function FieldRenderer({ field, value, onChange, ctx }: { field: FieldDef; value: unknown; onChange: (value: unknown) => void; ctx: FieldContext }) {
  const id = `${ctx.idPrefix}-${field.key}`;

  if (field.type === "toggle") {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
        <span>
          <span className="font-medium">{field.label}</span>
          {field.hint ? <span className="block text-xs text-muted-foreground">{field.hint}</span> : null}
        </span>
        <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      </label>
    );
  }

  const control = (() => {
    switch (field.type) {
      case "text":
        return <Input id={id} value={typeof value === "string" ? value : ""} maxLength={field.max} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />;
      case "textarea":
        return (
          <>
            <Textarea id={id} rows={field.rows ?? 3} value={typeof value === "string" ? value : ""} maxLength={field.max} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
            <span className="self-end text-xs tabular-nums text-muted-foreground">
              {(typeof value === "string" ? value : "").length}/{field.max}
            </span>
          </>
        );
      case "number":
        return (
          <Input
            id={id}
            type="number"
            dir="ltr"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={typeof value === "number" ? value : ""}
            onChange={(event) => {
              const n = Number(event.target.value);
              onChange(Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, n)) : field.min);
            }}
          />
        );
      case "range":
        return (
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={typeof value === "number" ? value : field.min}
              onChange={(event) => onChange(Number(event.target.value))}
              className="flex-1 accent-[var(--primary)]"
            />
            <span className="w-12 text-end text-sm tabular-nums" dir="ltr">
              {typeof value === "number" ? value : field.min}
              {field.unit ?? ""}
            </span>
          </div>
        );
      case "select":
        return <Select id={id} value={typeof value === "string" ? value : String(value ?? "")} onChange={(event) => onChange(event.target.value)} options={field.options} />;
      case "color":
        return <ColorInput id={id} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v ?? "")} allowEmpty />;
      case "image":
        return <MediaField id={id} value={typeof value === "number" ? value : null} onChange={(mediaId) => onChange(mediaId)} />;
      case "images":
        return <MediaListField value={Array.isArray(value) ? (value as number[]) : []} onChange={(ids) => onChange(ids)} max={field.max} />;
      case "link":
        return <LinkField field={field} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v)} ctx={ctx} id={id} />;
      case "icon":
        return <IconField field={field} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v)} ctx={ctx} id={id} />;
      case "repeater":
        return <RepeaterField field={field} value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []} onChange={(v) => onChange(v)} ctx={ctx} id={id} />;
      case "group":
        return (
          <div className="rounded-lg border p-3">
            <FieldList fields={field.fields} values={(value as Record<string, unknown>) ?? {}} onChange={(patch) => onChange({ ...((value as Record<string, unknown>) ?? {}), ...patch })} ctx={{ ...ctx, idPrefix: id }} />
          </div>
        );
      case "order_fields":
        return <OrderFieldsField field={field} value={value as never} onChange={(v) => onChange(v)} ctx={ctx} id={id} />;
      case "custom_fields":
        return <CustomFieldsField field={field} value={Array.isArray(value) ? (value as never) : []} onChange={(v) => onChange(v)} ctx={ctx} id={id} />;
    }
  })();

  return (
    <FormField label={field.label} htmlFor={id} hint={field.hint}>
      {control}
    </FormField>
  );
}
