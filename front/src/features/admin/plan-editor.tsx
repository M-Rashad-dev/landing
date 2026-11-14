"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { DatePicker } from "@/components/forms/date-pickers";
import { FormLayout, FormSection, SaveBar, useUnsavedWarning } from "@/components/forms/form-layout";
import { MoneyInput } from "@/components/forms/inputs";
import { TagInput } from "@/components/forms/tag-input";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch, SwitchRow } from "@/components/ui/choice";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { isApiError, errorMessage } from "@/lib/api/errors";
import { formatMoney, isoToCairoInput } from "@/lib/format";
import { ar } from "@/messages/ar";
import { createPlan, deletePlan, PERIODS, updatePlan, useAdminPlanCatalog, type AdminPlanRow, type Entitlement, type Period } from "./catalog-api";

const t = ar.admin.plans.editor;

const priceSchema = z.object({
  sold: z.boolean(),
  price: z.string(),
  discount_percent: z.number({ error: t.discountInvalid }).int(t.discountInvalid).min(0, t.discountInvalid).max(90, t.discountInvalid),
  discount_starts_at: z.string(),
  discount_ends_at: z.string(),
  is_active: z.boolean(),
});

const schema = z
  .object({
    key: z.string(),
    name: z.string().trim().min(1, t.nameRequired).max(60),
    tagline: z.string().max(150),
    description: z.string().max(2000),
    marketing_points: z.array(z.string().max(120)).max(10),
    is_public: z.boolean(),
    is_highlighted: z.boolean(),
    is_archived: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
    prices: z.object({ monthly: priceSchema, yearly: priceSchema }),
    limits: z.record(z.string(), z.object({ unlimited: z.boolean(), value: z.number().int().min(0).max(1_000_000).nullable() })),
    features: z.record(z.string(), z.boolean()),
  })
  .superRefine((v, ctx) => {
    for (const period of PERIODS) {
      const p = v.prices[period];
      if (p.sold && (p.price.trim() === "" || Number.isNaN(Number(p.price)))) ctx.addIssue({ code: "custom", path: ["prices", period, "price"], message: t.priceRequired });
    }
    if (!PERIODS.some((period) => v.prices[period].sold)) ctx.addIssue({ code: "custom", path: ["prices", "monthly", "sold"], message: t.pricesHint });
    for (const [key, limit] of Object.entries(v.limits)) {
      if (!limit.unlimited && (limit.value === null || Number.isNaN(limit.value))) ctx.addIssue({ code: "custom", path: ["limits", key, "value"], message: ar.validation.required });
    }
  });
type Values = z.infer<typeof schema>;

function toValues(plan: AdminPlanRow | null, catalog: Entitlement[], creating: boolean): Values {
  const prices = {} as Values["prices"];
  for (const period of PERIODS) {
    const p = plan?.prices[period] ?? null;
    prices[period] = {
      sold: p !== null || (creating && period === "monthly"),
      price: p ? String(p.price) : "",
      discount_percent: p?.discount_percent ?? 0,
      discount_starts_at: isoToCairoInput(p?.discount_starts_at),
      discount_ends_at: isoToCairoInput(p?.discount_ends_at),
      is_active: p?.is_active ?? true,
    };
  }
  const limits: Values["limits"] = {};
  const features: Values["features"] = {};
  for (const e of catalog) {
    const value = plan?.values[e.key];
    if (e.kind === "limit") limits[e.key] = { unlimited: plan !== null && value === null, value: typeof value === "number" ? value : plan === null ? 0 : null };
    else features[e.key] = value === true;
  }
  return {
    key: plan?.key ?? "",
    name: plan?.name ?? "",
    tagline: plan?.tagline ?? "",
    description: plan?.description ?? "",
    marketing_points: plan?.marketing_points ?? [],
    is_public: plan?.is_public ?? true,
    is_highlighted: plan?.is_highlighted ?? false,
    is_archived: plan?.is_archived ?? false,
    sort_order: plan?.sort_order ?? 0,
    prices,
    limits,
    features,
  };
}

export function PlanEditorPage({ planKey }: { planKey: string | null }) {
  const query = useAdminPlanCatalog();
  if (query.isPending) return <Skeleton className="h-[32rem] rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const plan = planKey ? (query.data.data.find((p) => p.key === planKey) ?? null) : null;
  if (planKey && !plan) return <ErrorState message={ar.errors.notFound} />;
  return <PlanEditor plan={plan} catalog={query.data.meta.entitlements} trialPlanKey={query.data.meta.settings.trial_plan_key} />;
}

function PlanEditor({ plan, catalog, trialPlanKey }: { plan: AdminPlanRow | null; catalog: Entitlement[]; trialPlanKey: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const creating = plan === null;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(plan, catalog, creating) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [deleting, setDeleting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  useUnsavedWarning(isDirty && !isSubmitting);

  const limits = catalog.filter((e) => e.kind === "limit");
  const features = catalog.filter((e) => e.kind === "feature");
  const labelOf = (e: Entitlement) => (ar.settings.billing.limits as Record<string, string>)[e.key] ?? (ar.settings.billing.features as Record<string, string>)[e.key] ?? e.label;

  const submit = form.handleSubmit(async (v) => {
    if (creating && !/^[a-z][a-z0-9_]{1,39}$/.test(v.key)) {
      form.setError("key", { message: t.keyInvalid });
      return;
    }
    const prices = {} as Record<Period, { price: number; discount_percent: number; discount_starts_at: string | null; discount_ends_at: string | null; is_active: boolean } | null>;
    for (const period of PERIODS) {
      const p = v.prices[period];
      prices[period] = p.sold ? { price: Number(p.price), discount_percent: p.discount_percent, discount_starts_at: p.discount_starts_at || null, discount_ends_at: p.discount_ends_at || null, is_active: p.is_active } : null;
    }
    const values: Record<string, boolean | number | null> = { ...v.features };
    for (const [key, limit] of Object.entries(v.limits)) values[key] = limit.unlimited ? null : limit.value;
    const body = {
      name: v.name.trim(),
      tagline: v.tagline.trim() || null,
      description: v.description.trim() || null,
      marketing_points: v.marketing_points,
      is_public: v.is_public,
      is_highlighted: v.is_highlighted,
      is_archived: v.is_archived,
      sort_order: v.sort_order,
      prices,
      values,
    };
    try {
      const saved = creating ? await createPlan({ key: v.key, ...body }) : await updatePlan(plan.key, body);
      await client.invalidateQueries({ queryKey: ["admin", "plans"] });
      toast.success(creating ? t.created : t.saved);
      form.reset(toValues(saved, catalog, false));
      if (creating) router.replace(`/admin/plans/${saved.key}`);
    } catch (error) {
      if (isApiError(error) && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === "key" || field === "name") form.setError(field, { message: messages[0] });
        }
      }
      toast.error(errorMessage(error));
    }
  });

  async function remove() {
    if (!plan) return;
    setBusy(true);
    try {
      await deletePlan(plan.key);
      await client.invalidateQueries({ queryKey: ["admin", "plans"] });
      toast.success(t.deleted);
      router.replace("/admin/plans");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      setDeleting(false);
    }
  }

  const canDelete = plan !== null && plan.subscribers === 0 && plan.key !== trialPlanKey;

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        crumbs={[{ label: t.back, href: "/admin/plans" }, { label: plan?.name ?? t.newTitle }]}
        title={plan?.name ?? t.newTitle}
        description={plan ? ar.admin.plans.subscribers(plan.subscribers) : undefined}
        actions={
          canDelete ? (
            <Button type="button" variant="outline" onClick={() => setDeleting(true)}>
              <Trash2 />
              {t.delete}
            </Button>
          ) : null
        }
      />
      <FormLayout
        aside={
          <FormSection title={t.visibility}>
            <div className="flex flex-col divide-y divide-border">
              <Controller control={form.control} name="is_public" render={({ field }) => <SwitchRow title={t.isPublic} description={t.isPublicHint} checked={field.value} onCheckedChange={field.onChange} />} />
              <Controller control={form.control} name="is_highlighted" render={({ field }) => <SwitchRow title={t.isHighlighted} checked={field.value} onCheckedChange={field.onChange} />} />
              <Controller control={form.control} name="is_archived" render={({ field }) => <SwitchRow title={t.isArchived} description={t.isArchivedHint} checked={field.value} onCheckedChange={field.onChange} />} />
            </div>
            <Field label={t.sortOrder} htmlFor="plan-sort" className="mt-3">
              <Input id="plan-sort" type="number" inputMode="numeric" dir="ltr" className="tabular max-w-28" {...form.register("sort_order", { valueAsNumber: true })} />
            </Field>
          </FormSection>
        }
      >
        <FormSection title={t.details}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.name} htmlFor="plan-name" error={errors.name?.message} required>
              <Input id="plan-name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </Field>
            {creating ? (
              <Field label={t.key} htmlFor="plan-key" hint={t.keyHint} error={errors.key?.message} required>
                <Input id="plan-key" dir="ltr" autoComplete="off" aria-invalid={Boolean(errors.key)} {...form.register("key", { setValueAs: (v: string) => v.trim().toLowerCase() })} />
              </Field>
            ) : (
              <Field label={t.key}>
                <Input value={plan.key} dir="ltr" disabled readOnly />
              </Field>
            )}
            <Field label={t.tagline} htmlFor="plan-tagline" className="sm:col-span-2" optional>
              <Input id="plan-tagline" {...form.register("tagline")} />
            </Field>
            <Field label={t.description} htmlFor="plan-description" className="sm:col-span-2" optional>
              <Textarea id="plan-description" rows={3} {...form.register("description")} />
            </Field>
            <Field label={t.points} hint={t.pointsHint} className="sm:col-span-2" optional>
              <Controller control={form.control} name="marketing_points" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} max={10} maxLength={120} removeLabel={t.removePoint} />} />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t.prices} description={t.pricesHint}>
          {/* One period per row until the screen is wide enough for both cards with their date pickers. */}
          <div className="grid gap-4 2xl:grid-cols-2">
            {PERIODS.map((period) => (
              <PriceFields key={period} form={form} period={period} now={plan?.prices[period]?.now ?? null} />
            ))}
          </div>
          {errors.prices?.monthly?.sold?.message ? <p className="mt-2 text-xs text-danger">{errors.prices.monthly.sold.message}</p> : null}
        </FormSection>

        <FormSection title={t.limits} description={t.limitsHint}>
          <div className="grid gap-3 sm:grid-cols-2">
            {limits.map((e) => (
              <LimitField key={e.key} form={form} entitlement={e} label={labelOf(e)} />
            ))}
          </div>
        </FormSection>

        <FormSection title={t.features}>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {features.map((e) => (
              <Controller key={e.key} control={form.control} name={`features.${e.key}`} render={({ field }) => <SwitchRow title={labelOf(e)} checked={field.value} onCheckedChange={field.onChange} />} />
            ))}
          </div>
        </FormSection>
      </FormLayout>
      <SaveBar visible={isDirty || creating} saving={isSubmitting} onSave={() => void submit()} onDiscard={creating ? undefined : () => form.reset()} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={t.deleteTitle} description={t.deleteText} confirmLabel={t.delete} destructive loading={busy} onConfirm={() => void remove()} />
    </form>
  );
}

function PriceFields({ form, period, now }: { form: UseFormReturn<Values>; period: Period; now: { final: number } | null }) {
  const sold = useWatch({ control: form.control, name: `prices.${period}.sold` });
  const errors = form.formState.errors.prices?.[period];
  const id = (f: string) => `price-${period}-${f}`;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <label className="flex items-center justify-between gap-2 text-sm font-semibold">
        {t.sold(t.periods[period])}
        <Controller control={form.control} name={`prices.${period}.sold`} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t.sold(t.periods[period])} />} />
      </label>
      {sold ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.price} htmlFor={id("price")} error={errors?.price?.message} required>
              <Controller control={form.control} name={`prices.${period}.price`} render={({ field }) => <MoneyInput id={id("price")} value={field.value} onChange={field.onChange} aria-invalid={Boolean(errors?.price)} />} />
            </Field>
            <Field label={t.discountPercent} htmlFor={id("discount")} error={errors?.discount_percent?.message}>
              <Input id={id("discount")} type="number" inputMode="numeric" min={0} max={90} dir="ltr" className="tabular" {...form.register(`prices.${period}.discount_percent`, { valueAsNumber: true })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.discountStarts}>
              <Controller control={form.control} name={`prices.${period}.discount_starts_at`} render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} withTime />} />
            </Field>
            <Field label={t.discountEnds}>
              <Controller control={form.control} name={`prices.${period}.discount_ends_at`} render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} withTime />} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Controller control={form.control} name={`prices.${period}.is_active`} render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />} />
            {t.priceActive}
          </label>
          {now ? <p className="text-xs text-ink-3">{t.now(formatMoney(now.final))}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function LimitField({ form, entitlement, label }: { form: UseFormReturn<Values>; entitlement: Entitlement; label: string }) {
  const unlimited = useWatch({ control: form.control, name: `limits.${entitlement.key}.unlimited` });
  const error = form.formState.errors.limits?.[entitlement.key]?.value?.message;
  const id = `limit-${entitlement.key}`;
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          dir="ltr"
          className="tabular max-w-32"
          disabled={unlimited}
          aria-invalid={Boolean(error)}
          {...form.register(`limits.${entitlement.key}.value`, { setValueAs: (v: string | number | null) => (v === "" || v === null ? null : Number(v)) })}
        />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <Controller control={form.control} name={`limits.${entitlement.key}.unlimited`} render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />} />
          {t.unlimited}
        </label>
      </div>
    </Field>
  );
}
