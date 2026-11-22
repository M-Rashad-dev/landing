"use client";

import { FileUp, ImagePlus, Plus, Type, AlignRight, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { MoneyInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { ar } from "@/messages/ar";
import type { InputKind } from "./api";
import { MAX_INPUTS, type ProductValues } from "./form-model";

const t = ar.catalog.form.inputs;
const KINDS: InputKind[] = ["text", "textarea", "image", "file"];
const ICONS = { text: Type, textarea: AlignRight, image: ImagePlus, file: FileUp } as const;

/** «حسب الطلب»: what the customer types (a name to print, an account id) or uploads (a photo, a design) when buying. */
export function InputsEditor() {
  const { control } = useFormContext<ProductValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "inputs" });

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <InputCard key={field.id} index={index} onRemove={() => remove(index)} />
      ))}
      {fields.length < MAX_INPUTS ? (
        <div className="flex flex-wrap gap-2">
          {KINDS.map((kind) => {
            const Icon = ICONS[kind];
            return (
              <Button key={kind} type="button" variant={kind === "text" ? "outline" : "ghost"} size="sm" onClick={() => append({ id: null, kind, label: "", placeholder: "", is_required: kind !== "textarea", price_delta: "" })}>
                {kind === "text" ? <Plus /> : <Icon />}
                {t.add[kind]}
              </Button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-ink-3">{t.max}</p>
      )}
    </div>
  );
}

function InputCard({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { control, register, formState, watch } = useFormContext<ProductValues>();
  const errors = formState.errors.inputs?.[index];
  const kind = watch(`inputs.${index}.kind`);
  const upload = kind === "image" || kind === "file";

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <Field label={t.kind}>
        <Controller control={control} name={`inputs.${index}.kind`} render={({ field }) => <Segmented value={field.value} onChange={field.onChange} options={KINDS.map((k) => ({ value: k, label: t.kinds[k] }))} />} />
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t.label} htmlFor={`in-${index}-label`} error={errors?.label?.message} required>
          <Input id={`in-${index}-label`} placeholder={t.labelPlaceholder[kind]} aria-invalid={!!errors?.label} {...register(`inputs.${index}.label`)} />
        </Field>
        {upload ? (
          <p className="self-end pb-2 text-xs text-ink-3">{kind === "image" ? t.imageHint : t.fileHint}</p>
        ) : (
          <Field label={t.placeholder} htmlFor={`in-${index}-ph`} error={errors?.placeholder?.message} optional>
            <Input id={`in-${index}-ph`} placeholder={t.placeholderExample} {...register(`inputs.${index}.placeholder`)} />
          </Field>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Controller
          control={control}
          name={`inputs.${index}.is_required`}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              {upload ? t.requiredUpload : t.required}
            </label>
          )}
        />
        <Controller
          control={control}
          name={`inputs.${index}.price_delta`}
          render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} placeholder="0" aria-label={t.priceDelta} className="w-36" />}
        />
        <span className="text-[11px] text-ink-3">{t.priceDeltaHint}</span>
        <Button type="button" variant="danger-ghost" size="sm" className="ms-auto" onClick={onRemove}>
          <Trash2 />
          {t.remove}
        </Button>
      </div>
      {errors?.price_delta ? <p className="mt-1 text-xs text-danger">{errors.price_delta.message}</p> : null}
    </div>
  );
}
