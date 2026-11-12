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
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/overlay";
import { MultiSelect } from "@/components/ui/select";
import { useShipping } from "@/features/shipping/api";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { BENEFITS, saveShippingOffer, useRefresh, type Benefit, type ShippingOffer } from "../api";
import { BASE_FIELDS, baseDefaults, basePayload, baseShape, checkInt, checkMoney, checkTarget, num } from "../form-utils";
import { PeriodFields, TargetFields } from "../shared";

const t = ar.promotions.shippingOffers;
const p = ar.promotions;

const schema = z
  .object({
    name: z.string().trim().max(100, ar.validation.max(100)),
    benefit: z.enum(BENEFITS as [Benefit, ...Benefit[]]),
    value: z.string(),
    min_quantity: z.string(),
    min_total: z.string(),
    governorates: z.array(z.string()),
    company_ids: z.array(z.number()),
    ...baseShape,
  })
  .superRefine((v, ctx) => {
    if (v.benefit === "discount") checkMoney(ctx, "value", v.value);
    if (v.benefit === "flat") checkMoney(ctx, "value", v.value, { allowZero: true });
    checkInt(ctx, "min_quantity", v.min_quantity, 1, 1000, false);
    checkMoney(ctx, "min_total", v.min_total, { required: false });
    checkTarget(ctx, v);
  });

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "benefit", "value", "min_quantity", "min_total", "governorates", "company_ids", ...BASE_FIELDS] as const;

export type ShippingOfferDrawerState = { mode: "create" } | { mode: "edit"; offer: ShippingOffer } | null;

export function ShippingOfferDrawer({ state, onClose }: { state: ShippingOfferDrawerState; onClose: () => void }) {
  return (
    <Drawer open={state !== null} onOpenChange={(o) => !o && onClose()} title={state?.mode === "edit" ? t.editTitle : t.newTitle} width="lg">
      {state ? <ShippingOfferForm key={state.mode === "edit" ? state.offer.id : "new"} offer={state.mode === "edit" ? state.offer : null} onDone={onClose} /> : null}
    </Drawer>
  );
}

/** "شحن مجاني لما يشتري 3 قطع" — the default name and the list summary. */
export function shippingOfferSummary(v: { benefit: Benefit; value: string; min_quantity: string; min_total: string }): string {
  const what = v.benefit === "free" ? t.summary.free : v.benefit === "discount" ? t.summary.discount(v.value) : t.summary.flat(v.value);
  const when = [num(v.min_quantity) ? t.summary.minQuantity(Number(v.min_quantity)) : null, num(v.min_total) ? t.summary.minTotal(v.min_total) : null].filter(Boolean).join(t.summary.and);
  return when ? `${what} ${when}` : what;
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function ShippingOfferForm({ offer, onDone }: { offer: ShippingOffer | null; onDone: () => void }) {
  const refresh = useRefresh("shippingOffers");
  const shipping = useShipping();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: offer?.name ?? "",
      benefit: offer?.benefit ?? "free",
      value: str(offer?.value),
      min_quantity: str(offer?.min_quantity),
      min_total: str(offer?.min_total),
      governorates: offer?.governorates ?? [],
      company_ids: offer?.company_ids ?? [],
      ...baseDefaults(offer, "all"),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const watched = useWatch({ control: form.control });
  const benefit = (watched.benefit ?? "free") as Benefit;
  const summary = shippingOfferSummary({ benefit, value: watched.value ?? "", min_quantity: watched.min_quantity ?? "", min_total: watched.min_total ?? "" });

  async function onSubmit(values: Values) {
    setFormError(null);
    const body = {
      name: values.name.trim() || summary,
      benefit: values.benefit,
      value: values.benefit === "free" ? null : values.value,
      min_quantity: num(values.min_quantity),
      min_total: values.min_total.trim() || null,
      governorates: values.governorates,
      company_ids: values.company_ids,
      ...basePayload(values),
    };
    try {
      await saveShippingOffer(body, offer?.id);
      toast.success(offer ? t.saved : t.created);
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

      <Field label={t.benefit}>
        <Controller
          control={form.control}
          name="benefit"
          render={({ field }) => <RadioCards className="sm:grid-cols-3" value={field.value} onValueChange={field.onChange} options={BENEFITS.map((b) => ({ value: b, title: t.benefits[b].title, description: t.benefits[b].description }))} />}
        />
      </Field>
      {benefit !== "free" ? (
        <Field label={benefit === "discount" ? t.discountValue : t.flatValue} htmlFor="ship-offer-value" error={errors.value?.message} required>
          <Controller control={form.control} name="value" render={({ field }) => <MoneyInput id="ship-offer-value" value={field.value} onChange={field.onChange} className="sm:w-60" aria-invalid={!!errors.value} />} />
        </Field>
      ) : null}

      <FormSection title={t.conditions} description={t.conditionsHint}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.minQuantity} htmlFor="ship-offer-min-q" error={errors.min_quantity?.message} optional>
            <Input id="ship-offer-min-q" inputMode="numeric" placeholder="3" aria-invalid={!!errors.min_quantity} {...form.register("min_quantity")} />
          </Field>
          <Field label={t.minTotal} htmlFor="ship-offer-min-t" error={errors.min_total?.message} optional>
            <Controller control={form.control} name="min_total" render={({ field }) => <MoneyInput id="ship-offer-min-t" value={field.value} onChange={field.onChange} aria-invalid={!!errors.min_total} />} />
          </Field>
        </div>
      </FormSection>

      <div className="rounded-lg border border-brand/30 bg-brand-soft/50 px-3 py-2.5 text-sm">
        <span className="text-xs text-ink-3">{p.summaryTitle}</span>
        <p className="font-semibold text-brand-strong">{summary}</p>
      </div>

      <FormSection title={p.target.label} description={watched.applies_to === "all" ? undefined : t.countedFrom}>
        <TargetFields
          idPrefix="ship-offer"
          value={{ applies_to: watched.applies_to ?? "all", product_ids: (watched.product_ids ?? []) as number[], category_ids: (watched.category_ids ?? []) as number[] }}
          onChange={(x) => {
            form.setValue("applies_to", x.applies_to, { shouldDirty: true });
            form.setValue("product_ids", x.product_ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
            form.setValue("category_ids", x.category_ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
          }}
          errors={{ product_ids: errors.product_ids?.message, category_ids: errors.category_ids?.message }}
        />
      </FormSection>

      <FormSection title={t.where}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.governorates} htmlFor="ship-offer-gov" error={errors.governorates?.message}>
            <Controller
              control={form.control}
              name="governorates"
              render={({ field }) => (
                <MultiSelect
                  id="ship-offer-gov"
                  value={field.value}
                  onChange={field.onChange}
                  options={(shipping.data?.governorates ?? []).map((g) => ({ value: g, label: g }))}
                  placeholder={t.allGovernorates}
                  countLabel={t.governoratesCount}
                />
              )}
            />
          </Field>
          <Field label={t.companies} htmlFor="ship-offer-companies" error={errors.company_ids?.message}>
            <Controller
              control={form.control}
              name="company_ids"
              render={({ field }) => (
                <MultiSelect
                  id="ship-offer-companies"
                  value={field.value.map(String)}
                  onChange={(ids) => field.onChange(ids.map(Number))}
                  options={(shipping.data?.companies ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder={t.allCompanies}
                  countLabel={t.companiesCount}
                />
              )}
            />
          </Field>
        </div>
      </FormSection>

      <Field label={ar.promotions.offers.name} htmlFor="ship-offer-name" hint={p.autoName} error={errors.name?.message} optional>
        <Input id="ship-offer-name" placeholder={summary} aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>

      <FormSection title={p.period.title} description={p.period.hint}>
        <PeriodFields
          idPrefix="ship-offer"
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
