"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Shuffle } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormSection } from "@/components/forms/form-layout";
import { MoneyInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { AddonInput, Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/overlay";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { COUPON_TYPES, saveCoupon, useRefresh, type Coupon, type CouponType } from "../api";
import { BASE_FIELDS, baseDefaults, basePayload, baseShape, checkInt, checkMoney, checkTarget, num } from "../form-utils";
import { PeriodFields, TargetFields } from "../shared";

const t = ar.promotions.coupons;
const p = ar.promotions;

/** Back end: DiscountCodeRequest (A-Z, 0-9, _ and -, 3 to 30). */
export const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

const schema = z
  .object({
    code: z
      .string()
      .transform((s) => s.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().min(1, ar.validation.required).regex(CODE_PATTERN, t.codeHint)),
    type: z.enum(COUPON_TYPES as [CouponType, ...CouponType[]]),
    value: z.string(),
    max_discount: z.string(),
    min_order_total: z.string(),
    min_quantity: z.string(),
    first_order_only: z.boolean(),
    usage_limit: z.string(),
    usage_limit_per_phone: z.string(),
    stackable_with_offers: z.boolean(),
    ...baseShape,
  })
  .superRefine((v, ctx) => {
    if (v.type === "percentage") checkInt(ctx, "value", v.value, 1, 100);
    if (v.type === "fixed") checkMoney(ctx, "value", v.value);
    if (v.type === "percentage") checkMoney(ctx, "max_discount", v.max_discount, { required: false });
    checkMoney(ctx, "min_order_total", v.min_order_total, { required: false, allowZero: true });
    checkInt(ctx, "min_quantity", v.min_quantity, 1, 1000, false);
    checkInt(ctx, "usage_limit", v.usage_limit, 1, 1_000_000, false);
    checkInt(ctx, "usage_limit_per_phone", v.usage_limit_per_phone, 1, 1000, false);
    checkTarget(ctx, v);
  });

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;
const FIELDS = ["code", "type", "value", "max_discount", "min_order_total", "min_quantity", "first_order_only", "usage_limit", "usage_limit_per_phone", "stackable_with_offers", ...BASE_FIELDS] as const;

export type CouponDrawerState = { mode: "create" } | { mode: "edit"; coupon: Coupon } | null;

export function CouponDrawer({ state, onClose }: { state: CouponDrawerState; onClose: () => void }) {
  return (
    <Drawer open={state !== null} onOpenChange={(o) => !o && onClose()} title={state?.mode === "edit" ? t.editTitle : t.newTitle} width="lg">
      {state ? <CouponForm key={state.mode === "edit" ? state.coupon.id : "new"} coupon={state.mode === "edit" ? state.coupon : null} onDone={onClose} /> : null}
    </Drawer>
  );
}

/** "خصم 10% (لحد 150 ج.م) · للطلبات من 500 ج.م · لأول طلب". */
export function couponSummary(v: { type: CouponType; value: string; max_discount: string; min_order_total: string; min_quantity: string; first_order_only: boolean }): string {
  const what = v.type === "percentage" ? t.summary.percentage(v.value || "…", v.max_discount) : v.type === "fixed" ? t.summary.fixed(v.value) : t.summary.free_shipping;
  return [what, num(v.min_order_total) ? t.summary.minTotal(v.min_order_total) : null, num(v.min_quantity) ? t.summary.minQuantity(Number(v.min_quantity)) : null, v.first_order_only ? t.summary.firstOrder : null].filter(Boolean).join(" · ");
}

/** 8 characters without look-alikes (0/O, 1/I). */
export function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function CouponForm({ coupon, onDone }: { coupon: Coupon | null; onDone: () => void }) {
  const refresh = useRefresh("coupons");
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: coupon?.code ?? "",
      type: coupon?.type ?? "percentage",
      value: str(coupon?.value),
      max_discount: str(coupon?.max_discount),
      min_order_total: str(coupon?.min_order_total),
      min_quantity: str(coupon?.min_quantity),
      first_order_only: coupon?.first_order_only ?? false,
      usage_limit: str(coupon?.usage_limit),
      usage_limit_per_phone: str(coupon?.usage_limit_per_phone),
      stackable_with_offers: coupon?.stackable_with_offers ?? true,
      ...baseDefaults(coupon, "all"),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const watched = useWatch({ control: form.control });
  const type = (watched.type ?? "percentage") as CouponType;
  const summary = couponSummary({ type, value: watched.value ?? "", max_discount: watched.max_discount ?? "", min_order_total: watched.min_order_total ?? "", min_quantity: watched.min_quantity ?? "", first_order_only: watched.first_order_only ?? false });

  async function onSubmit(values: Values) {
    setFormError(null);
    const body = {
      code: values.code,
      type: values.type,
      value: values.type === "free_shipping" ? null : values.value,
      max_discount: values.type === "percentage" ? values.max_discount.trim() || null : null,
      min_order_total: values.min_order_total.trim() || null,
      min_quantity: num(values.min_quantity),
      first_order_only: values.first_order_only,
      usage_limit: num(values.usage_limit),
      usage_limit_per_phone: num(values.usage_limit_per_phone),
      stackable_with_offers: values.stackable_with_offers,
      ...basePayload(values),
    };
    try {
      await saveCoupon(body, coupon?.id);
      toast.success(coupon ? t.saved : t.created);
      await refresh();
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label={t.code} htmlFor="coupon-code" hint={t.codeHint} error={errors.code?.message} required>
        <div className="flex gap-2">
          <Input id="coupon-code" dir="ltr" autoFocus={!coupon} className="font-mono uppercase tracking-wider" placeholder="WELCOME10" aria-invalid={!!errors.code} {...form.register("code")} />
          <Button type="button" variant="outline" onClick={() => form.setValue("code", randomCode(), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}>
            <Shuffle />
            {t.generate}
          </Button>
        </div>
      </Field>

      <Field label={t.type} error={errors.type?.message}>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => <RadioCards className="sm:grid-cols-3" value={field.value} onValueChange={field.onChange} options={COUPON_TYPES.map((x) => ({ value: x, title: t.types[x].title, description: t.types[x].description }))} />}
        />
      </Field>
      {type === "percentage" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.percent} htmlFor="coupon-value" error={errors.value?.message} required>
            <AddonInput id="coupon-value" addon="%" inputMode="numeric" aria-invalid={!!errors.value} {...form.register("value")} />
          </Field>
          <Field label={t.maxDiscount} htmlFor="coupon-max" hint={t.maxDiscountHint} error={errors.max_discount?.message} optional>
            <Controller control={form.control} name="max_discount" render={({ field }) => <MoneyInput id="coupon-max" value={field.value} onChange={field.onChange} aria-invalid={!!errors.max_discount} />} />
          </Field>
        </div>
      ) : null}
      {type === "fixed" ? (
        <Field label={t.amount} htmlFor="coupon-value" error={errors.value?.message} required>
          <Controller control={form.control} name="value" render={({ field }) => <MoneyInput id="coupon-value" value={field.value} onChange={field.onChange} className="sm:w-60" aria-invalid={!!errors.value} />} />
        </Field>
      ) : null}

      <div className="rounded-lg border border-brand/30 bg-brand-soft/50 px-3 py-2.5 text-sm">
        <span className="text-xs text-ink-3">{p.summaryTitle}</span>
        <p className="font-semibold text-brand-strong">{summary}</p>
      </div>

      <FormSection title={p.target.label}>
        <TargetFields
          idPrefix="coupon"
          value={{ applies_to: watched.applies_to ?? "all", product_ids: (watched.product_ids ?? []) as number[], category_ids: (watched.category_ids ?? []) as number[] }}
          onChange={(x) => {
            form.setValue("applies_to", x.applies_to, { shouldDirty: true });
            form.setValue("product_ids", x.product_ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
            form.setValue("category_ids", x.category_ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
          }}
          errors={{ product_ids: errors.product_ids?.message, category_ids: errors.category_ids?.message }}
        />
      </FormSection>

      <FormSection title={t.conditions}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.minOrderTotal} htmlFor="coupon-min-total" error={errors.min_order_total?.message} optional>
            <Controller control={form.control} name="min_order_total" render={({ field }) => <MoneyInput id="coupon-min-total" value={field.value} onChange={field.onChange} aria-invalid={!!errors.min_order_total} />} />
          </Field>
          <Field label={t.minQuantity} htmlFor="coupon-min-q" error={errors.min_quantity?.message} optional>
            <Input id="coupon-min-q" inputMode="numeric" aria-invalid={!!errors.min_quantity} {...form.register("min_quantity")} />
          </Field>
        </div>
        <Controller control={form.control} name="first_order_only" render={({ field }) => <SwitchRow title={t.firstOrder} description={t.firstOrderHint} checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller control={form.control} name="stackable_with_offers" render={({ field }) => <SwitchRow title={t.stackable} description={t.stackableHint} checked={field.value} onCheckedChange={field.onChange} />} />
      </FormSection>

      <FormSection title={t.limits}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.usageLimit} htmlFor="coupon-limit" error={errors.usage_limit?.message} optional>
            <Input id="coupon-limit" inputMode="numeric" placeholder={t.unlimited} aria-invalid={!!errors.usage_limit} {...form.register("usage_limit")} />
          </Field>
          <Field label={t.usageLimitPerPhone} htmlFor="coupon-limit-phone" error={errors.usage_limit_per_phone?.message} optional>
            <Input id="coupon-limit-phone" inputMode="numeric" placeholder={t.unlimited} aria-invalid={!!errors.usage_limit_per_phone} {...form.register("usage_limit_per_phone")} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={p.period.title} description={p.period.hint}>
        <PeriodFields
          idPrefix="coupon"
          starts={watched.starts_at ?? ""}
          ends={watched.ends_at ?? ""}
          onChange={(x) => {
            form.setValue("starts_at", x.starts, { shouldDirty: true });
            form.setValue("ends_at", x.ends, { shouldDirty: true });
          }}
          errors={{ starts_at: errors.starts_at?.message, ends_at: errors.ends_at?.message }}
        />
      </FormSection>

      <Controller control={form.control} name="is_active" render={({ field }) => <SwitchRow title={p.active} description={p.activeHint} checked={field.value} onCheckedChange={field.onChange} />} />

      <div className="sticky bottom-0 -mx-5 -mb-4 flex gap-2 border-t border-border bg-surface px-5 py-3">
        <Button type="submit" loading={isSubmitting}>
          {ar.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {ar.common.cancel}
        </Button>
      </div>
    </form>
  );
}
