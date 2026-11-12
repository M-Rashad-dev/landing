"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { Select } from "@/components/ui/select";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { OFFER_TYPES, saveOffer, useProductChoices, useRefresh, type Offer, type OfferType } from "../api";
import { BASE_FIELDS, baseDefaults, basePayload, baseShape, checkInt, checkMoney, checkTarget, num } from "../form-utils";
import { PeriodFields, TargetFields } from "../shared";

const t = ar.promotions.offers;
const p = ar.promotions;

const schema = z
  .object({
    name: z.string().trim().max(100, ar.validation.max(100)),
    badge_text: z.string().trim().max(40, ar.validation.max(40)),
    type: z.enum(OFFER_TYPES as [OfferType, ...OfferType[]]),
    value: z.string(),
    min_quantity: z.string(),
    bundle_quantity: z.string(),
    bundle_price: z.string(),
    free_quantity: z.string(),
    gift_product_id: z.number().nullable(),
    priority: z.string(),
    ...baseShape,
  })
  .superRefine((v, ctx) => {
    if (v.type === "percentage") checkInt(ctx, "value", v.value, 1, 95);
    if (v.type === "fixed") checkMoney(ctx, "value", v.value);
    if (v.type === "bundle") {
      checkInt(ctx, "bundle_quantity", v.bundle_quantity, 2, 20);
      checkMoney(ctx, "bundle_price", v.bundle_price);
    }
    if (v.type === "buy_get") {
      checkInt(ctx, "min_quantity", v.min_quantity, 1, 19);
      checkInt(ctx, "free_quantity", v.free_quantity, 1, 10);
    }
    if (v.type === "percentage" || v.type === "fixed" || v.type === "gift") checkInt(ctx, "min_quantity", v.min_quantity, 1, 20, false);
    if (v.type === "gift" && v.gift_product_id === null) ctx.addIssue({ code: "custom", path: ["gift_product_id"], message: ar.validation.required });
    checkInt(ctx, "priority", v.priority, 0, 1000, false);
    checkTarget(ctx, v);
  });

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "badge_text", "type", "value", "min_quantity", "bundle_quantity", "bundle_price", "free_quantity", "gift_product_id", "priority", ...BASE_FIELDS] as const;

export type OfferDrawerState = { mode: "create" } | { mode: "edit"; offer: Offer } | null;

export function OfferDrawer({ state, onClose }: { state: OfferDrawerState; onClose: () => void }) {
  return (
    <Drawer open={state !== null} onOpenChange={(o) => !o && onClose()} title={state?.mode === "edit" ? t.editTitle : t.newTitle} width="lg">
      {state ? <OfferForm key={state.mode === "edit" ? state.offer.id : "new"} offer={state.mode === "edit" ? state.offer : null} onDone={onClose} /> : null}
    </Drawer>
  );
}

/** The sentence the customer reads, from the current settings (also the default name). */
export function offerSummary(v: { type: OfferType; value: string; min_quantity: string; bundle_quantity: string; bundle_price: string; free_quantity: string }, giftName: string): string {
  const min = Math.max(1, Number(v.min_quantity) || 1);
  switch (v.type) {
    case "percentage":
      return t.summary.percentage(v.value || "…", min);
    case "fixed":
      return t.summary.fixed(v.value, min);
    case "bundle":
      return t.summary.bundle(Number(v.bundle_quantity) || 2, v.bundle_price);
    case "buy_get":
      return t.summary.buy_get(Number(v.min_quantity) || 1, Number(v.free_quantity) || 1);
    case "gift":
      return t.summary.gift(giftName, min);
  }
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function OfferForm({ offer, onDone }: { offer: Offer | null; onDone: () => void }) {
  const refresh = useRefresh("offers");
  const products = useProductChoices();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: offer?.name ?? "",
      badge_text: offer?.badge_text ?? "",
      type: offer?.type ?? "percentage",
      value: str(offer?.value),
      min_quantity: offer ? str(offer.min_quantity) : "",
      bundle_quantity: str(offer?.bundle_quantity ?? 2),
      bundle_price: str(offer?.bundle_price),
      free_quantity: str(offer?.free_quantity ?? 1),
      gift_product_id: offer?.gift_product_id ?? null,
      priority: str(offer?.priority ?? 0),
      ...baseDefaults(offer, "products"),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const watched = useWatch({ control: form.control });
  const type = (watched.type ?? "percentage") as OfferType;
  const giftName = (products.data ?? []).find((x) => x.id === watched.gift_product_id)?.name ?? offer?.gift_product?.name ?? "";
  const summary = offerSummary({ type, value: watched.value ?? "", min_quantity: watched.min_quantity ?? "", bundle_quantity: watched.bundle_quantity ?? "", bundle_price: watched.bundle_price ?? "", free_quantity: watched.free_quantity ?? "" }, giftName);

  async function onSubmit(values: Values) {
    setFormError(null);
    const body = {
      name: values.name.trim() || summary,
      badge_text: values.badge_text.trim() || null,
      type: values.type,
      value: values.type === "percentage" || values.type === "fixed" ? values.value : null,
      min_quantity: num(values.min_quantity),
      bundle_quantity: values.type === "bundle" ? num(values.bundle_quantity) : null,
      bundle_price: values.type === "bundle" ? values.bundle_price : null,
      free_quantity: values.type === "buy_get" ? num(values.free_quantity) : null,
      gift_product_id: values.type === "gift" ? values.gift_product_id : null,
      priority: num(values.priority) ?? 0,
      ...basePayload(values),
    };
    try {
      await saveOffer(body, offer?.id);
      toast.success(offer ? t.saved : t.created);
      await refresh();
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  const productOptions = (products.data ?? []).map((x) => ({ value: String(x.id), label: x.name }));

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label={t.type}>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <RadioCards value={field.value} onValueChange={field.onChange} options={OFFER_TYPES.map((x) => ({ value: x, title: t.types[x].title, description: t.types[x].description }))} />
          )}
        />
      </Field>

      {type === "percentage" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.value} htmlFor="offer-value" error={errors.value?.message} required>
            <AddonInput id="offer-value" addon="%" inputMode="numeric" aria-invalid={!!errors.value} {...form.register("value")} />
          </Field>
          <MinQuantity form={form} error={errors.min_quantity?.message} />
        </div>
      ) : null}
      {type === "fixed" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.amount} htmlFor="offer-value" error={errors.value?.message} required>
            <Controller control={form.control} name="value" render={({ field }) => <MoneyInput id="offer-value" value={field.value} onChange={field.onChange} aria-invalid={!!errors.value} />} />
          </Field>
          <MinQuantity form={form} error={errors.min_quantity?.message} />
        </div>
      ) : null}
      {type === "bundle" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.bundleQuantity} htmlFor="offer-bundle-q" error={errors.bundle_quantity?.message} required>
            <Input id="offer-bundle-q" inputMode="numeric" aria-invalid={!!errors.bundle_quantity} {...form.register("bundle_quantity")} />
          </Field>
          <Field label={t.bundlePrice} htmlFor="offer-bundle-p" error={errors.bundle_price?.message} required>
            <Controller control={form.control} name="bundle_price" render={({ field }) => <MoneyInput id="offer-bundle-p" value={field.value} onChange={field.onChange} aria-invalid={!!errors.bundle_price} />} />
          </Field>
        </div>
      ) : null}
      {type === "buy_get" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.buy} htmlFor="offer-buy" error={errors.min_quantity?.message} required>
            <Input id="offer-buy" inputMode="numeric" aria-invalid={!!errors.min_quantity} {...form.register("min_quantity")} />
          </Field>
          <Field label={t.free} htmlFor="offer-free" error={errors.free_quantity?.message} required>
            <Input id="offer-free" inputMode="numeric" aria-invalid={!!errors.free_quantity} {...form.register("free_quantity")} />
          </Field>
        </div>
      ) : null}
      {type === "gift" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.giftProduct} htmlFor="offer-gift" hint={t.giftHint} error={errors.gift_product_id?.message} required>
            <Controller
              control={form.control}
              name="gift_product_id"
              render={({ field }) => <Select id="offer-gift" value={field.value === null ? "" : String(field.value)} onValueChange={(x) => field.onChange(x ? Number(x) : null)} options={productOptions} placeholder={t.giftProduct} invalid={!!errors.gift_product_id} />}
            />
          </Field>
          <MinQuantity form={form} error={errors.min_quantity?.message} />
        </div>
      ) : null}

      <div className="rounded-lg border border-brand/30 bg-brand-soft/50 px-3 py-2.5 text-sm">
        <span className="text-xs text-ink-3">{p.summaryTitle}</span>
        <p className="font-semibold text-brand-strong">{summary}</p>
      </div>

      <FormSection title={p.target.label}>
        <TargetFields
          idPrefix="offer"
          value={{ applies_to: watched.applies_to ?? "products", product_ids: (watched.product_ids ?? []) as number[], category_ids: (watched.category_ids ?? []) as number[] }}
          onChange={(x) => {
            form.setValue("applies_to", x.applies_to, { shouldDirty: true });
            form.setValue("product_ids", x.product_ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
            form.setValue("category_ids", x.category_ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
          }}
          errors={{ product_ids: errors.product_ids?.message, category_ids: errors.category_ids?.message }}
        />
      </FormSection>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.name} htmlFor="offer-name" hint={p.autoName} error={errors.name?.message} optional>
          <Input id="offer-name" placeholder={summary} aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field label={t.badge} htmlFor="offer-badge" hint={t.badgeHint} error={errors.badge_text?.message} optional>
          <Input id="offer-badge" placeholder={t.badgePlaceholder} aria-invalid={!!errors.badge_text} {...form.register("badge_text")} />
        </Field>
      </div>

      <FormSection title={p.period.title} description={p.period.hint}>
        <PeriodFields
          idPrefix="offer"
          starts={watched.starts_at ?? ""}
          ends={watched.ends_at ?? ""}
          onChange={(x) => {
            form.setValue("starts_at", x.starts, { shouldDirty: true });
            form.setValue("ends_at", x.ends, { shouldDirty: true });
          }}
          errors={{ starts_at: errors.starts_at?.message, ends_at: errors.ends_at?.message }}
        />
      </FormSection>

      <FormSection title={t.advanced} collapsible defaultOpen={false} hasError={!!errors.priority}>
        <Field label={t.priority} htmlFor="offer-priority" hint={t.priorityHint} error={errors.priority?.message}>
          <Input id="offer-priority" inputMode="numeric" className="sm:w-32" aria-invalid={!!errors.priority} {...form.register("priority")} />
        </Field>
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

function MinQuantity({ form, error }: { form: ReturnType<typeof useForm<Values>>; error?: string }) {
  return (
    <Field label={t.minQuantity} htmlFor="offer-min" hint={t.minQuantityHint} error={error}>
      <Input id="offer-min" inputMode="numeric" placeholder="1" aria-invalid={!!error} {...form.register("min_quantity")} />
    </Field>
  );
}
