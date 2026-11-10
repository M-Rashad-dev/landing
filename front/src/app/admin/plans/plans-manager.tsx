"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil } from "lucide-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { planKeys, saveBillingSettings, useAdminPlans, type AdminPlan, type BillingSettings } from "@/lib/admin/api";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.admin.plans;

export function PlansManager() {
  const { data, isPending, isError, error, refetch } = useAdminPlans();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {data.plans.length === 0 ? (
        <EmptyState icon={Crown} title={ar.common.noResults} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {data.plans.map((plan) => (
            <li key={plan.key}>
              <PlanCard plan={plan} />
            </li>
          ))}
        </ul>
      )}
      <TrialSettings settings={data.settings} plans={data.plans} />
    </div>
  );
}

function PlanCard({ plan }: { plan: AdminPlan }) {
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{plan.name}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {plan.key}
          </p>
        </div>
        <Badge variant="secondary">{t.subscribers(plan.subscribers)}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plan.is_highlighted ? <Badge variant="gold">{t.highlighted}</Badge> : null}
        {plan.is_archived ? <Badge variant="destructive">{t.archived}</Badge> : null}
        {!plan.is_public ? <Badge variant="outline">{t.hidden}</Badge> : null}
      </div>
      <dl className="flex flex-col gap-1 text-sm">
        {(["monthly", "yearly"] as const).map((period) => {
          const price = plan.prices[period];
          if (!price?.now) return null;
          return (
            <div key={period} className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{ar.billing.periods[period]}</dt>
              <dd className="flex items-center gap-2 font-semibold tabular-nums">
                {price.now.discount_percent > 0 ? <span className="text-xs text-muted-foreground line-through">{formatPrice(price.now.original)}</span> : null}
                {formatPrice(price.now.final)}
              </dd>
            </div>
          );
        })}
      </dl>
      <Button variant="outline" className="mt-auto" asChild>
        <Link href={`/admin/plans/${plan.key}`}>
          <Pencil />
          {t.edit}
        </Link>
      </Button>
    </Card>
  );
}

const settingsSchema = z.object({
  trial_enabled: z.boolean(),
  trial_days: z.coerce.number().int().min(1).max(90),
  trial_plan_key: z.string().min(1),
  grace_hours: z.coerce.number().int().min(0).max(168),
});

function TrialSettings({ settings, plans }: { settings: BillingSettings; plans: AdminPlan[] }) {
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof settingsSchema>, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema), defaultValues: settings });
  const { errors, isSubmitting, isDirty } = form.formState;
  const options = plans.filter((p) => !p.is_archived).map((p) => ({ value: p.key, label: p.name }));

  async function onSubmit(values: BillingSettings) {
    try {
      const saved = await saveBillingSettings(values);
      form.reset(saved);
      await queryClient.invalidateQueries({ queryKey: planKeys.all });
      toast.success(t.settingsSaved);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, Object.keys(settingsSchema.shape));
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.trialTitle}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <span className="font-semibold">{t.trialEnabled}</span>
            <Controller control={form.control} name="trial_enabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </label>
          <FormField label={t.trialDays} htmlFor="trial-days" error={errors.trial_days?.message} required>
            <Input id="trial-days" type="number" dir="ltr" min={1} max={90} {...form.register("trial_days")} />
          </FormField>
          <FormField label={t.trialPlan} htmlFor="trial-plan" error={errors.trial_plan_key?.message} required>
            <Controller control={form.control} name="trial_plan_key" render={({ field }) => <Select id="trial-plan" options={options} value={field.value} onChange={(e) => field.onChange(e.target.value)} />} />
          </FormField>
          <FormField label={t.graceHours} htmlFor="grace-hours" error={errors.grace_hours?.message} hint={t.graceHint} required>
            <Input id="grace-hours" type="number" dir="ltr" min={0} max={168} {...form.register("grace_hours")} />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
