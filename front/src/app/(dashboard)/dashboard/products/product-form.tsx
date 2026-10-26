"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormGetValues, type UseFormRegister } from "react-hook-form";
import { ColorInput } from "@/components/forms/color-input";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { MediaListField } from "@/components/shared/media-picker/media-list-field";
import { Markdown } from "@/components/shared/markdown";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes";
import { discountPercent, formatPrice } from "@/lib/price";
import { productKeys, saveProduct } from "@/lib/products/api";
import { formToPayload, newKey, newOption, newValue, productSchema, productToForm, type ProductFormValues } from "@/lib/products/form";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.products;
const ROOTS = ["name", "description", "sku", "price", "compare_at_price", "is_active", "media_ids", "options"];

export function ProductForm({ product, onSaved }: { product?: Product; onSaved?: (product: Product) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: productToForm(product), mode: "onTouched" });
  const { register, control, handleSubmit, formState, setError, reset, getValues } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const [previewing, setPreviewing] = useState(false);
  const options = useFieldArray({ control, name: "options", keyName: "_rhf" });
  const watched = useWatch({ control });
  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const discount = discountPercent(watched.price, watched.compare_at_price);

  async function onSubmit(values: ProductFormValues) {
    try {
      const saved = await saveProduct(formToPayload(values), product?.id);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(product ? t.saved : t.created);
      reset(productToForm(saved));
      if (onSaved) onSaved(saved);
      else router.push("/dashboard/products");
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, ROOTS);
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormSection title={t.sections.basics} hasError={Boolean(errors.name || errors.description || errors.sku)}>
        <FormField label={t.fields.name} htmlFor="product-name" error={errors.name?.message} required>
          <Input id="product-name" maxLength={150} aria-invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label={t.fields.description} htmlFor="product-description" error={errors.description?.message} hint={t.fields.descriptionHint}>
          <div className="flex gap-1 self-end" role="tablist">
            <Button type="button" size="sm" variant={previewing ? "ghost" : "secondary"} onClick={() => setPreviewing(false)} role="tab" aria-selected={!previewing}>
              {t.write}
            </Button>
            <Button type="button" size="sm" variant={previewing ? "secondary" : "ghost"} onClick={() => setPreviewing(true)} role="tab" aria-selected={previewing}>
              {t.preview}
            </Button>
          </div>
          {previewing ? (
            <Markdown className="prose-sm min-h-32 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5">{watched.description || "—"}</Markdown>
          ) : (
            <Textarea id="product-description" rows={7} maxLength={10000} {...register("description")} />
          )}
        </FormField>
        <FormField label={t.fields.sku} htmlFor="product-sku" error={errors.sku?.message} optional>
          <Input id="product-sku" dir="ltr" className="text-start sm:max-w-xs" maxLength={60} {...register("sku")} />
        </FormField>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-semibold">{t.fields.active}</span>
                <span className="block text-xs text-muted-foreground">{t.fields.activeHint}</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </FormSection>

      <FormSection title={t.sections.pricing} hasError={Boolean(errors.price || errors.compare_at_price)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={`${t.fields.price} (${ar.common.currency})`} htmlFor="product-price" error={errors.price?.message} required>
            <Input id="product-price" inputMode="decimal" dir="ltr" className="text-start" placeholder="0.00" aria-invalid={!!errors.price} {...register("price")} />
          </FormField>
          <FormField label={`${t.fields.compareAt} (${ar.common.currency})`} htmlFor="product-compare" error={errors.compare_at_price?.message} hint={t.fields.compareAtHint}>
            <Input id="product-compare" inputMode="decimal" dir="ltr" className="text-start" placeholder="0.00" aria-invalid={!!errors.compare_at_price} {...register("compare_at_price")} />
          </FormField>
        </div>
        {watched.price ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="text-lg font-bold">{formatPrice(watched.price)}</span>
            {discount ? (
              <>
                <span className="text-muted-foreground line-through">{formatPrice(watched.compare_at_price)}</span>
                <Badge variant="destructive">{t.fields.discount(discount)}</Badge>
              </>
            ) : null}
          </p>
        ) : null}
      </FormSection>

      <FormSection title={t.sections.images} description={t.imagesHint} hasError={Boolean(errors.media_ids)}>
        <Controller control={control} name="media_ids" render={({ field }) => <MediaListField value={field.value} onChange={field.onChange} max={10} showMainBadge invalid={!!errors.media_ids} />} />
      </FormSection>

      <FormSection title={t.sections.options} description={t.options.max} hasError={Boolean(errors.options)}>
        {options.fields.length === 0 ? <p className="text-sm text-muted-foreground">{t.options.empty}</p> : null}
        <SortableList
          items={options.fields}
          getId={(field) => field.key}
          onMove={options.move}
          renderItem={(field, index, handle) => (
            <OptionEditor control={control} register={register} getValues={getValues} errors={errors} index={index} handle={handle} onRemove={() => options.remove(index)} />
          )}
        />
        {typeof errors.options?.message === "string" ? <p className="text-xs text-destructive">{errors.options.message}</p> : null}
        <Button type="button" variant="outline" className="self-start" disabled={options.fields.length >= 5} onClick={() => options.append(newOption())}>
          <Plus />
          {t.options.add}
        </Button>
        {(watched.options?.length ?? 0) > 0 ? <OptionsPreview control={control} /> : null}
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/products")}>
          {ar.common.cancel}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {ar.common.save}
        </Button>
      </div>
    </form>
  );
}

function OptionEditor({
  control,
  register,
  getValues,
  errors,
  index,
  handle,
  onRemove,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  getValues: UseFormGetValues<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  index: number;
  handle: Parameters<typeof DragHandle>[0]["handle"];
  onRemove: () => void;
}) {
  const values = useFieldArray({ control, name: `options.${index}.values`, keyName: "_rhf" });
  const displayType = useWatch({ control, name: `options.${index}.display_type` });
  const optionErrors = errors.options?.[index];

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <DragHandle handle={handle} />
        <FormField label={t.options.name} htmlFor={`option-${index}-name`} error={optionErrors?.name?.message} className="min-w-40 flex-1" required>
          <Input id={`option-${index}-name`} placeholder={t.options.namePlaceholder} maxLength={40} aria-invalid={!!optionErrors?.name} {...register(`options.${index}.name`)} />
        </FormField>
        <FormField label={t.options.displayType} htmlFor={`option-${index}-type`} className="w-36">
          <Select id={`option-${index}-type`} options={(["buttons", "dropdown", "swatch"] as const).map((type) => ({ value: type, label: t.options.types[type] }))} {...register(`options.${index}.display_type`)} />
        </FormField>
        <Controller
          control={control}
          name={`options.${index}.is_required`}
          render={({ field }) => (
            <label className="flex h-10 items-center gap-2 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              {t.options.required}
            </label>
          )}
        />
        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onRemove} aria-label={t.options.removeOption}>
          <Trash2 />
        </Button>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">{t.options.values}</p>
      <SortableList
        items={values.fields}
        getId={(field) => field.key}
        onMove={values.move}
        renderItem={(field, valueIndex, valueHandle) => {
          const valueErrors = optionErrors?.values?.[valueIndex];
          return (
            <div className="flex flex-wrap items-start gap-2 rounded-lg border bg-card p-2">
              <DragHandle handle={valueHandle} className="mt-1" />
              <div className="min-w-28 flex-1">
                <Input aria-label={t.options.label} placeholder={t.options.label} maxLength={40} aria-invalid={!!valueErrors?.label} {...register(`options.${index}.values.${valueIndex}.label`)} />
                {valueErrors?.label?.message ? <p className="mt-1 text-xs text-destructive">{valueErrors.label.message}</p> : null}
              </div>
              {displayType === "swatch" ? (
                <div className="w-44">
                  <Controller
                    control={control}
                    name={`options.${index}.values.${valueIndex}.color_hex`}
                    render={({ field: colorField }) => <ColorInput value={colorField.value} onChange={(v) => colorField.onChange(v ?? "")} invalid={!!valueErrors?.color_hex} />}
                  />
                  {valueErrors?.color_hex?.message ? <p className="mt-1 text-xs text-destructive">{valueErrors.color_hex.message}</p> : null}
                </div>
              ) : null}
              <div className="w-32">
                <Input aria-label={t.options.priceDelta} placeholder={`+ ${t.options.priceDelta}`} inputMode="decimal" dir="ltr" className="text-start" aria-invalid={!!valueErrors?.price_delta} {...register(`options.${index}.values.${valueIndex}.price_delta`)} />
                {valueErrors?.price_delta?.message ? <p className="mt-1 text-xs text-destructive">{valueErrors.price_delta.message}</p> : null}
              </div>
              <Controller
                control={control}
                name={`options.${index}.values.${valueIndex}.is_active`}
                render={({ field: activeField }) => (
                  <label className="flex h-10 items-center gap-1.5 text-xs">
                    <Switch checked={activeField.value} onCheckedChange={activeField.onChange} />
                    {t.options.valueActive}
                  </label>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.options.duplicateValue}
                disabled={values.fields.length >= 30}
                onClick={() => {
                  const current = getValues(`options.${index}.values.${valueIndex}`);
                  values.insert(valueIndex + 1, { ...current, id: undefined, key: newKey(), label: `${current.label} 2` });
                }}
              >
                <Copy />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={t.options.removeValue} disabled={values.fields.length <= 1} onClick={() => values.remove(valueIndex)}>
                <Trash2 />
              </Button>
            </div>
          );
        }}
      />
      {typeof optionErrors?.values?.message === "string" ? <p className="mt-1 text-xs text-destructive">{optionErrors.values.message}</p> : null}
      <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={values.fields.length >= 30} onClick={() => values.append(newValue())}>
        <Plus />
        {t.options.addValue}
      </Button>
    </div>
  );
}

/** How a visitor will see the options (display only). */
function OptionsPreview({ control }: { control: Control<ProductFormValues> }) {
  const options = useWatch({ control, name: "options" });
  const [picked, setPicked] = useState<Record<string, string>>({});

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">{t.options.livePreview}</p>
      <div className="flex flex-col gap-4">
        {options.map((option) => {
          const values = option.values.filter((value) => value.is_active && value.label.trim());
          if (!option.name.trim() || values.length === 0) return null;
          return (
            <div key={option.key}>
              <p className="mb-2 text-sm font-semibold">
                {option.name}
                {option.is_required ? <span className="text-destructive"> *</span> : null}
              </p>
              {option.display_type === "dropdown" ? (
                <Select
                  aria-label={option.name}
                  value={picked[option.key] ?? ""}
                  onChange={(event) => setPicked((p) => ({ ...p, [option.key]: event.target.value }))}
                  placeholder={t.options.choose}
                  options={values.map((value) => ({ value: value.key, label: value.price_delta && Number(value.price_delta) > 0 ? `${value.label} (+${formatPrice(value.price_delta)})` : value.label }))}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const selected = picked[option.key] === value.key;
                    return option.display_type === "swatch" ? (
                      <button
                        key={value.key}
                        type="button"
                        onClick={() => setPicked((p) => ({ ...p, [option.key]: value.key }))}
                        className={cn("size-9 rounded-full border-2 ring-offset-2", selected ? "ring-2 ring-primary" : "")}
                        style={{ background: value.color_hex || "#e5e7eb" }}
                        title={value.label}
                        aria-label={value.label}
                        aria-pressed={selected}
                      />
                    ) : (
                      <button
                        key={value.key}
                        type="button"
                        onClick={() => setPicked((p) => ({ ...p, [option.key]: value.key }))}
                        aria-pressed={selected}
                        className={cn("rounded-lg border px-3 py-1.5 text-sm", selected ? "border-primary bg-secondary font-semibold text-primary" : "hover:bg-accent")}
                      >
                        {value.label}
                        {value.price_delta && Number(value.price_delta) > 0 ? <span className="ms-1 text-xs text-muted-foreground">+{formatPrice(value.price_delta)}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
