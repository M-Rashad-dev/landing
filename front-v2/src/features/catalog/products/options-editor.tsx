"use client";

import { Palette, Plus, Ruler, Trash2, X } from "lucide-react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ColorInput, MoneyInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { ar } from "@/messages/ar";
import type { OptionValues, ProductValues } from "./form-model";

const t = ar.catalog.form.options;

const blankValue = (color = "") => ({ id: null, label: "", color_hex: color, price_delta: "", is_active: true });

/** Size, color... each with its values; a value may change the price (up or down). */
export function OptionsEditor() {
  const { control } = useFormContext<ProductValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "options" });

  const presets: Array<{ key: string; icon: typeof Ruler; option: OptionValues }> = [
    { key: "size", icon: Ruler, option: { id: null, name: "المقاس", display_type: "buttons", is_required: true, values: t.presetSizeValues.map((l) => ({ ...blankValue(), label: l })) } },
    { key: "color", icon: Palette, option: { id: null, name: "اللون", display_type: "swatch", is_required: true, values: [blankValue("#000000")] } },
  ];

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <OptionCard key={field.id} index={index} onRemove={() => remove(index)} />
      ))}
      {fields.length < 5 ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => append({ id: null, name: "", display_type: "buttons", is_required: true, values: [blankValue()] })}>
            <Plus />
            {t.add}
          </Button>
          {presets.map(({ key, icon: Icon, option }) => (
            <Button key={key} type="button" variant="ghost" size="sm" onClick={() => append(option)}>
              <Icon />
              {t.presets[key as keyof typeof t.presets]}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-3">{t.max}</p>
      )}
    </div>
  );
}

function OptionCard({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { control, register, formState } = useFormContext<ProductValues>();
  const { fields, append, remove } = useFieldArray({ control, name: `options.${index}.values` });
  const display = useWatch({ control, name: `options.${index}.display_type` });
  const errors = formState.errors.options?.[index];

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label={t.name} htmlFor={`opt-${index}-name`} error={errors?.name?.message}>
          <Input id={`opt-${index}-name`} placeholder={t.namePlaceholder} aria-invalid={!!errors?.name} {...register(`options.${index}.name`)} />
        </Field>
        <Field label={t.display}>
          <Controller
            control={control}
            name={`options.${index}.display_type`}
            render={({ field }) => (
              <Segmented
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "buttons", label: t.displayTypes.buttons },
                  { value: "dropdown", label: t.displayTypes.dropdown },
                  { value: "swatch", label: t.displayTypes.swatch },
                ]}
              />
            )}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <span className="text-[13px] font-semibold">{t.values}</span>
        <ul className="flex flex-col gap-2">
          {fields.map((field, j) => {
            const err = errors?.values?.[j];
            return (
              <li key={field.id} className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-surface p-2">
                {display === "swatch" ? (
                  <Controller control={control} name={`options.${index}.values.${j}.color_hex`} render={({ field: f }) => <ColorInput value={f.value} onChange={f.onChange} />} />
                ) : null}
                <Input className="min-w-28 flex-1" placeholder={t.valuePlaceholder} aria-label={t.valueLabel} aria-invalid={!!err?.label} {...register(`options.${index}.values.${j}.label`)} />
                <Controller
                  control={control}
                  name={`options.${index}.values.${j}.price_delta`}
                  render={({ field: f }) => <MoneyInput signed value={f.value} onChange={f.onChange} placeholder="0" aria-label={`${t.priceDelta} (${t.priceDeltaHint})`} className="w-36" />}
                />
                <Controller
                  control={control}
                  name={`options.${index}.values.${j}.is_active`}
                  render={({ field: f }) => (
                    <label className="flex h-9 items-center gap-2 text-xs text-ink-2">
                      <Switch checked={f.value} onCheckedChange={f.onChange} aria-label={t.activeValue} />
                      {t.activeValue}
                    </label>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(j)} aria-label={t.removeValue}>
                  <X />
                </Button>
                {err?.label ? <p className="w-full text-xs text-danger">{err.label.message}</p> : null}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-ink-3">
          {t.priceDelta}: {t.priceDeltaHint}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {fields.length < 30 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => append(blankValue(display === "swatch" ? "#000000" : ""))}>
            <Plus />
            {t.addValue}
          </Button>
        ) : null}
        <Controller
          control={control}
          name={`options.${index}.is_required`}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              {t.required}
            </label>
          )}
        />
        <Button type="button" variant="danger-ghost" size="sm" className="ms-auto" onClick={onRemove}>
          <Trash2 />
          {t.remove}
        </Button>
      </div>
    </div>
  );
}
