"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ErrorState } from "@/components/dashboard/error-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateTimeField } from "@/components/forms/datetime-field";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { createPlan, deletePlan, planKeys, updatePlan, useAdminPlans, type AdminPlan, type PlanPayload } from "@/lib/admin/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { PLAN_FEATURES, PLAN_LIMITS, type BillingPeriod, type EntitlementInfo, type PlanValues } from "@/lib/billing/types";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.admin.plans;
const PERIODS: BillingPeriod[] = ["monthly", "yearly"];

const priceSchema = z.object({
  sold: z.boolean(),
  price: z.string(),
  discount_percent: z.string(),
  discount_starts_at: z.string(),
  discount_ends_at: z.string(),
  is_active: z.boolean(),
});

const limitValue = z.string().regex(/^\d{0,7}$/, ar.validation.number);

const schema = z
  .object({
    key: z.string(),
    name: z.string().trim().min(1, ar.validation.required).max(60),
    tagline: z.string().max(150),
    description: z.string().max(2000),
    points: z.string().max(1500),
    is_public: z.boolean(),
    is_highlighted: z.boolean(),
    is_archived: z.boolean(),
    sort_order: z.string().regex(/^\d{1,4}$/, ar.validation.number),
    prices: z.object({ monthly: priceSchema, yearly: priceSchema }),
    limits: z.object(Object.fromEntries(PLAN_LIMITS.map((k) => [k, limitValue])) as Record<(typeof PLAN_LIMITS)[number], typeof limitValue>),
    features: z.object(Object.fromEntries(PLAN_FEATURES.map((k) => [k, z.boolean()])) as Record<(typeof PLAN_FEATURES)[number], z.ZodBoolean>),
  })
  .superRefine((v, ctx) => {
    for (const period of PERIODS) {
      const p = v.prices[period];
      if (!p.sold) continue;
      if (!/^\d{1,7}(\.\d{1,2})?$/.test(p.price)) ctx.addIssue({ code: "custom", path: ["prices", period, "price"], message: ar.validation.number });
      const d = Number(p.discount_percent || 0);
      if (!Number.isInteger(d) || d < 0 || d > 90) ctx.addIssue({ code: "custom", path: ["prices", period, "discount_percent"], message: ar.validation.number });
    }
  });

type FormValues = z.infer<typeof schema>;

function toForm(plan: AdminPlan | null): FormValues {
  const price = (period: BillingPeriod) => {
    const p = plan?.prices[period] ?? null;
    return {
      sold: plan === null ? period === "monthly" : p !== null,
      price: p ? String(p.price) : "",
      discount_percent: p ? String(p.discount_percent) : "0",
      discount_starts_at: toCairoInputValue(p?.discount_starts_at ?? null),
      discount_ends_at: toCairoInputValue(p?.discount_ends_at ?? null),
      is_active: p?.is_active ?? true,
    };
  };

  return {
    key: plan?.key ?? "",
    name: plan?.name ?? "",
    tagline: plan?.tagline ?? "",
    description: plan?.description ?? "",
    points: (plan?.marketing_points ?? []).join("\n"),
    is_public: plan?.is_public ?? true,
    is_highlighted: plan?.is_highlighted ?? false,
    is_archived: plan?.is_archived ?? false,
    sort_order: String(plan?.sort_order ?? 10),
    prices: { monthly: price("monthly"), yearly: price("yearly") },
    limits: Object.fromEntries(PLAN_LIMITS.map((k) => [k, plan ? (plan.values[k] === null ? "" : String(plan.values[k])) : "0"])) as FormValues["limits"],
    features: Object.fromEntries(PLAN_FEATURES.map((k) => [k, plan ? Boolean(plan.values[k]) : false])) as FormValues["features"],
  };
}

function toPayload(v: FormValues, creating: boolean): PlanPayload {
  const values = {
    ...Object.fromEntries(PLAN_LIMITS.map((k) => [k, v.limits[k] === "" ? null : Number(v.limits[k])])),
    ...v.features,
  } as PlanValues;
  const price = (period: BillingPeriod) => {
    const p = v.prices[period];
    if (!p.sold) return null;
    return {
      price: Number(p.price),
      discount_percent: Number(p.discount_percent || 0),
      discount_starts_at: fromCairoInputValue(p.discount_starts_at),
      discount_ends_at: fromCairoInputValue(p.discount_ends_at),
      is_active: p.is_active,
    };
  };

  return {
    ...(creating ? { key: v.key.trim() } : {}),
    name: v.name.trim(),
    tagline: v.tagline.trim() || null,
    description: v.description.trim() || null,
    marketing_points: v.points.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10),
    is_public: v.is_public,
    is_highlighted: v.is_highlighted,
    is_archived: v.is_archived,
    sort_order: Number(v.sort_order),
    prices: { monthly: price("monthly"), yearly: price("yearly") },
    values,
  };
}

/** Server keys (prices.monthly.price, values.products) → form paths. */
function formPath(key: string): string {
  if (key.startsWith("values.")) {
    const name = key.slice(7);
    return (PLAN_FEATURES as readonly string[]).includes(name) ? `features.${name}` : `limits.${name}`;
  }
  if (key === "marketing_points" || key.startsWith("marketing_points.")) return "points";
  return key;
}

export function PlanEditor({ planKey }: { planKey: string | null }) {
  const { data, isPending, isError, error, refetch } = useAdminPlans();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-[40rem] rounded-xl" />;

  const plan = planKey ? (data.plans.find((p) => p.key === planKey) ?? null) : null;
  if (planKey && !plan) return <ErrorState />;

  return <PlanForm key={plan?.key ?? "new"} plan={plan} entitlements={data.entitlements} />;
}

function PlanForm({ plan, entitlements }: { plan: AdminPlan | null; entitlements: EntitlementInfo[] }) {
  const creating = plan === null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(plan) });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: FormValues) {
    try {
      const saved = creating ? await createPlan(toPayload(values, true)) : await updatePlan(plan.key, toPayload(values, false));
      await queryClient.invalidateQueries({ queryKey: planKeys.all });
      toast.success(creating ? t.created : t.saved);
      if (creating) router.replace(`/admin/plans/${saved.key}`);
      else form.reset(toForm(saved));
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        // Server paths (values.products) differ from the form's (limits.products).
        let first = true;
        for (const [key, messages] of Object.entries(error.errors)) {
          if (!messages[0]) continue;
          form.setError(formPath(key) as Parameters<typeof form.setError>[0], { type: "server", message: messages[0] }, { shouldFocus: first });
          first = false;
        }
        if (error.errors.prices?.[0]) toast.error(error.errors.prices[0]);
        return;
      }
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    if (!plan) return;
    setDeleting(true);
    try {
      await deletePlan(plan.key);
      await queryClient.invalidateQueries({ queryKey: planKeys.all });
      toast.success(t.deleted);
      router.replace("/admin/plans");
    } catch (error) {
      toast.error(errorMessage(error));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const label = (key: string) => entitlements.find((e) => e.key === key)?.label ?? key;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/admin/plans">
          <ArrowRight />
          {t.back}
        </Link>
      </Button>
      <PageHeader
        title={creating ? t.createTitle : t.editTitle(plan.name)}
        actions={
          <>
            {!creating ? (
              <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                {t.delete}
              </Button>
            ) : null}
            <Button type="submit" form="plan-form" loading={isSubmitting}>
              {t.save}
            </Button>
          </>
        }
      />

      <form id="plan-form" onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {creating ? (
              <FormField label={t.key} htmlFor="plan-key" hint={t.keyHint} error={errors.key?.message} required>
                <Input id="plan-key" dir="ltr" autoComplete="off" {...form.register("key")} />
              </FormField>
            ) : null}
            <FormField label={t.name} htmlFor="plan-name" error={errors.name?.message} required>
              <Input id="plan-name" {...form.register("name")} />
            </FormField>
            <FormField label={t.tagline} htmlFor="plan-tagline" error={errors.tagline?.message} optional>
              <Input id="plan-tagline" {...form.register("tagline")} />
            </FormField>
            <FormField label={t.descriptionField} htmlFor="plan-description" error={errors.description?.message} optional>
              <Textarea id="plan-description" rows={3} {...form.register("description")} />
            </FormField>
            <FormField label={t.points} htmlFor="plan-points" hint={t.pointsHint} error={errors.points?.message} optional>
              <Textarea id="plan-points" rows={4} {...form.register("points")} />
            </FormField>
            <FormField label={t.sortOrder} htmlFor="plan-sort" error={errors.sort_order?.message} required>
              <Input id="plan-sort" type="number" dir="ltr" min={0} max={1000} {...form.register("sort_order")} />
            </FormField>
            <SwitchRow form={form} name="is_public" label={t.isPublic} />
            <SwitchRow form={form} name="is_highlighted" label={t.isHighlighted} />
            <SwitchRow form={form} name="is_archived" label={t.isArchived} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.pricesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {PERIODS.map((period) => (
              <PriceFields key={period} form={form} period={period} now={plan?.prices[period]?.now ?? null} />
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.valuesTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{t.valuesHint}</p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="font-semibold">{t.limitsGroup}</p>
              {PLAN_LIMITS.map((key) => (
                <FormField key={key} label={label(key)} htmlFor={`limit-${key}`} error={errors.limits?.[key]?.message}>
                  <Input id={`limit-${key}`} inputMode="numeric" dir="ltr" placeholder={t.unlimited} {...form.register(`limits.${key}`)} />
                </FormField>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-semibold">{t.featuresGroup}</p>
              {PLAN_FEATURES.map((key) => (
                <SwitchRow key={key} form={form} name={`features.${key}`} label={label(key)} />
              ))}
            </div>
          </CardContent>
        </Card>
      </form>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={t.deleteTitle} description={t.deleteText} confirmLabel={t.delete} destructive loading={deleting} onConfirm={remove} />
    </>
  );
}

type BoolPath = "is_public" | "is_highlighted" | "is_archived" | `features.${(typeof PLAN_FEATURES)[number]}` | `prices.${BillingPeriod}.sold` | `prices.${BillingPeriod}.is_active`;

function SwitchRow({ form, name, label }: { form: UseFormReturn<FormValues>; name: BoolPath; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="text-sm font-semibold">{label}</span>
      <Controller control={form.control} name={name} render={({ field }) => <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
    </label>
  );
}

function PriceFields({ form, period, now }: { form: UseFormReturn<FormValues>; period: BillingPeriod; now: { final: number } | null }) {
  const sold = useWatch({ control: form.control, name: `prices.${period}.sold` });
  const errors = form.formState.errors.prices?.[period];

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <SwitchRow form={form} name={`prices.${period}.sold`} label={t.sold(ar.billing.periods[period])} />
      {sold ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t.price} htmlFor={`price-${period}`} error={errors?.price?.message} required>
            <Input id={`price-${period}`} inputMode="decimal" dir="ltr" {...form.register(`prices.${period}.price`)} />
          </FormField>
          <FormField label={t.discount} htmlFor={`discount-${period}`} error={errors?.discount_percent?.message}>
            <Input id={`discount-${period}`} inputMode="numeric" dir="ltr" {...form.register(`prices.${period}.discount_percent`)} />
          </FormField>
          <FormField label={t.discountStarts} htmlFor={`starts-${period}`} error={errors?.discount_starts_at?.message}>
            <Controller
              control={form.control}
              name={`prices.${period}.discount_starts_at`}
              render={({ field }) => <DateTimeField id={`starts-${period}`} value={field.value} onChange={field.onChange} emptyLabel={ar.common.optional} />}
            />
          </FormField>
          <FormField label={t.discountEnds} htmlFor={`ends-${period}`} error={errors?.discount_ends_at?.message}>
            <Controller
              control={form.control}
              name={`prices.${period}.discount_ends_at`}
              render={({ field }) => <DateTimeField id={`ends-${period}`} value={field.value} onChange={field.onChange} emptyLabel={ar.common.optional} />}
            />
          </FormField>
          <div className="sm:col-span-2">
            <SwitchRow form={form} name={`prices.${period}.is_active`} label={t.priceActive} />
          </div>
          {now ? <p className="text-xs text-muted-foreground sm:col-span-2">{t.priceNow(formatPrice(now.final))}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
