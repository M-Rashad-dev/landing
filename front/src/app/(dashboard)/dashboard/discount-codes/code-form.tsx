"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Shuffle } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DateTimeField } from "@/components/forms/datetime-field";
import { FormField } from "@/components/forms/form-field";
import { ProductMultiSelect } from "@/components/shared/product-multi-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/dates";
import { randomCode, saveCode, type CodePayload } from "@/lib/promotions/api";
import type { DiscountCode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.codes;
const moneyRe = /^\d{1,7}(\.\d{1,2})?$/;
const optionalMoney = z.string().trim().refine((v) => v === "" || moneyRe.test(v), ar.validation.number);
const optionalInt = z.string().trim().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), ar.validation.number);

const schema = z
  .object({
    code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/, t.fields.codeHint),
    type: z.enum(["percentage", "fixed"]),
    value: z.string().trim(),
    max_discount: optionalMoney,
    min_order_total: optionalMoney,
    starts_at: z.string(),
    ends_at: z.string(),
    usage_limit: optionalInt,
    usage_limit_per_phone: optionalInt,
    stackable_with_offers: z.boolean(),
    is_active: z.boolean(),
    product_ids: z.array(z.number()),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percentage" && !(/^\d+$/.test(v.value) && Number(v.value) >= 1 && Number(v.value) <= 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "1 – 100" });
    if (v.type === "fixed" && !(moneyRe.test(v.value) && Number(v.value) > 0)) ctx.addIssue({ code: "custom", path: ["value"], message: ar.validation.number });
    if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at) ctx.addIssue({ code: "custom", path: ["ends_at"], message: ar.offers.endsAfterStarts });
  });

type Values = z.infer<typeof schema>;

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function toValues(code: DiscountCode | null): Values {
  return {
    code: code?.code ?? "",
    type: code?.type ?? "percentage",
    value: str(code?.value),
    max_discount: str(code?.max_discount),
    min_order_total: str(code?.min_order_total),
    starts_at: toCairoInputValue(code?.starts_at),
    ends_at: toCairoInputValue(code?.ends_at),
    usage_limit: str(code?.usage_limit),
    usage_limit_per_phone: str(code?.usage_limit_per_phone),
    stackable_with_offers: code?.stackable_with_offers ?? true,
    is_active: code?.is_active ?? true,
    product_ids: code?.product_ids ?? [],
  };
}

function toPayload(v: Values): CodePayload {
  return {
    code: v.code.trim().toUpperCase(),
    type: v.type,
    value: v.value,
    max_discount: v.type === "percentage" && v.max_discount ? v.max_discount : null,
    min_order_total: v.min_order_total || null,
    starts_at: fromCairoInputValue(v.starts_at),
    ends_at: fromCairoInputValue(v.ends_at),
    usage_limit: v.usage_limit ? Number(v.usage_limit) : null,
    usage_limit_per_phone: v.usage_limit_per_phone ? Number(v.usage_limit_per_phone) : null,
    stackable_with_offers: v.stackable_with_offers,
    is_active: v.is_active,
    product_ids: v.product_ids,
  };
}

export function CodeFormDialog({ code, open, onClose, onSaved }: { code: DiscountCode | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg">{open ? <CodeForm key={code?.id ?? "new"} code={code} onClose={onClose} onSaved={onSaved} /> : null}</DialogContent>
    </Dialog>
  );
}

function CodeForm({ code, onClose, onSaved }: { code: DiscountCode | null; onClose: () => void; onSaved: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(code) });
  const { register, control, handleSubmit, formState, setError, setValue } = form;
  const { errors, isSubmitting } = formState;
  const type = useWatch({ control, name: "type" });

  async function onSubmit(values: Values) {
    try {
      await saveCode(toPayload(values), code?.id);
      toast.success(ar.promotions.saved);
      onSaved();
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, Object.keys(values));
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{code ? t.edit : t.new}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <FormField label={t.fields.code} htmlFor="code-code" error={errors.code?.message} hint={t.fields.codeHint} required>
          <div className="flex gap-2">
            <Input id="code-code" dir="ltr" className="font-mono uppercase" maxLength={30} aria-invalid={!!errors.code} {...register("code")} />
            <Button type="button" variant="outline" onClick={() => setValue("code", randomCode(), { shouldDirty: true, shouldValidate: true })}>
              <Shuffle />
              <span className="hidden sm:inline">{t.fields.generate}</span>
            </Button>
          </div>
        </FormField>

        <FormField label={t.fields.type}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.fields.type}>
                {(["percentage", "fixed"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option}
                    onClick={() => field.onChange(option)}
                    className={cn("rounded-lg border p-2.5 text-sm font-semibold", field.value === option ? "border-primary bg-secondary text-primary" : "hover:bg-accent")}
                  >
                    {t.types[option]}
                  </button>
                ))}
              </div>
            )}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={type === "percentage" ? t.fields.percent : t.fields.amount} htmlFor="code-value" error={errors.value?.message} required>
            <Input id="code-value" inputMode="decimal" dir="ltr" aria-invalid={!!errors.value} {...register("value")} />
          </FormField>
          {type === "percentage" ? (
            <FormField label={t.fields.maxDiscount} htmlFor="code-max" error={errors.max_discount?.message} hint={t.fields.maxDiscountHint}>
              <Input id="code-max" inputMode="decimal" dir="ltr" {...register("max_discount")} />
            </FormField>
          ) : null}
          <FormField label={t.fields.minOrder} htmlFor="code-min" error={errors.min_order_total?.message} optional>
            <Input id="code-min" inputMode="decimal" dir="ltr" {...register("min_order_total")} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={ar.offers.fields.startsAt} htmlFor="code-start" error={errors.starts_at?.message}>
            <Controller control={control} name="starts_at" render={({ field }) => <DateTimeField id="code-start" value={field.value} onChange={field.onChange} emptyLabel={ar.promotions.noStart} />} />
          </FormField>
          <FormField label={ar.offers.fields.endsAt} htmlFor="code-end" error={errors.ends_at?.message}>
            <Controller control={control} name="ends_at" render={({ field }) => <DateTimeField id="code-end" value={field.value} onChange={field.onChange} invalid={!!errors.ends_at} emptyLabel={ar.promotions.noEnd} />} />
          </FormField>
          <FormField label={t.fields.usageLimit} htmlFor="code-limit" error={errors.usage_limit?.message}>
            <Input id="code-limit" type="number" min={1} dir="ltr" placeholder={t.fields.unlimited} {...register("usage_limit")} />
          </FormField>
          <FormField label={t.fields.perPhone} htmlFor="code-per-phone" error={errors.usage_limit_per_phone?.message}>
            <Input id="code-per-phone" type="number" min={1} dir="ltr" placeholder={t.fields.unlimited} {...register("usage_limit_per_phone")} />
          </FormField>
        </div>

        <FormField label={t.fields.products} htmlFor="code-products" hint={t.fields.productsHint} error={errors.product_ids?.message}>
          <Controller control={control} name="product_ids" render={({ field }) => <ProductMultiSelect id="code-products" value={field.value} onChange={field.onChange} known={code?.products ?? []} placeholder={ar.promotions.allProducts} />} />
        </FormField>

        <Controller
          control={control}
          name="stackable_with_offers"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-semibold">{t.fields.stackable}</span>
                <span className="block text-xs text-muted-foreground">{t.fields.stackableHint}</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-semibold">
              {t.fields.active}
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {ar.common.cancel}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {ar.common.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
