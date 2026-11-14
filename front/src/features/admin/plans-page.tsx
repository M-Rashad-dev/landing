"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeDollarSign, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { PERIODS, saveBillingSettings, useAdminPlanCatalog, type AdminPlanRow, type BillingSettings } from "./catalog-api";

const t = ar.admin.plans;

export function PlansPage() {
  const query = useAdminPlanCatalog();
  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button asChild>
            <Link href="/admin/plans/new">
              <Plus />
              {t.add}
            </Link>
          </Button>
        }
      />
      {query.isPending ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_22rem]">
          {query.data.data.length === 0 ? (
            <EmptyState icon={BadgeDollarSign} title={t.empty} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {query.data.data.map((plan) => (
                <li key={plan.key}>
                  <PlanCard plan={plan} isTrial={plan.key === query.data.meta.settings.trial_plan_key} />
                </li>
              ))}
            </ul>
          )}
          <SettingsPanel settings={query.data.meta.settings} plans={query.data.data} />
        </div>
      )}
    </>
  );
}

function PlanCard({ plan, isTrial }: { plan: AdminPlanRow; isTrial: boolean }) {
  return (
    <Link href={`/admin/plans/${plan.key}`} className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
            {plan.name}
            <span dir="ltr" className="text-xs font-normal text-ink-3">
              {plan.key}
            </span>
          </p>
          {plan.tagline ? <p className="text-[13px] text-ink-3">{plan.tagline}</p> : null}
        </div>
        <Pencil className="size-4 shrink-0 text-ink-3" aria-label={t.edit} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plan.is_archived ? <Badge tone="neutral" size="sm">{t.archived}</Badge> : null}
        {!plan.is_public ? <Badge tone="warning" size="sm">{t.hidden}</Badge> : null}
        {plan.is_highlighted ? <Badge tone="brand-soft" size="sm">{t.highlighted}</Badge> : null}
        {isTrial ? <Badge tone="info" size="sm">{t.trialPlan}</Badge> : null}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {PERIODS.map((period) => {
          const price = plan.prices[period];
          return (
            <div key={period} className="rounded-lg bg-surface-2 px-3 py-2">
              <dt className="text-[11px] text-ink-3">{period === "monthly" ? t.perMonth : t.perYear}</dt>
              <dd className="tabular font-semibold">
                {price === null ? (
                  <span className="text-sm font-normal text-ink-3">{t.notSold}</span>
                ) : !price.is_active ? (
                  <span className="text-sm font-normal text-ink-3">{t.off}</span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-1.5">
                    {formatMoney(price.now?.final ?? price.price)}
                    {price.now && price.now.discount_percent > 0 ? <span className="text-xs font-normal text-success">{t.discount(price.now.discount_percent)}</span> : null}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-auto text-xs text-ink-3">{t.subscribers(plan.subscribers)}</p>
    </Link>
  );
}

const s = t.settings;
const settingsSchema = z.object({
  trial_enabled: z.boolean(),
  trial_days: z.number({ error: s.daysInvalid }).int(s.daysInvalid).min(1, s.daysInvalid).max(90, s.daysInvalid),
  trial_plan_key: z.string().min(1),
  grace_hours: z.number({ error: s.hoursInvalid }).int(s.hoursInvalid).min(0, s.hoursInvalid).max(168, s.hoursInvalid),
  invoice_hours: z.number({ error: s.hoursInvalid }).int(s.hoursInvalid).min(1, s.hoursInvalid).max(720, s.hoursInvalid),
  support_email: z.union([z.literal(""), z.email(s.emailInvalid).max(120)]),
  support_whatsapp: z.union([z.literal(""), z.string().regex(/^\+?[0-9]{8,15}$/, s.phoneInvalid)]),
});
type SettingsValues = z.infer<typeof settingsSchema>;

const toSettings = (v: BillingSettings): SettingsValues => ({
  trial_enabled: v.trial_enabled,
  trial_days: v.trial_days,
  trial_plan_key: v.trial_plan_key,
  grace_hours: v.grace_hours,
  invoice_hours: v.invoice_hours,
  support_email: v.support_email ?? "",
  support_whatsapp: v.support_whatsapp ?? "",
});

function SettingsPanel({ settings, plans }: { settings: BillingSettings; plans: AdminPlanRow[] }) {
  const client = useQueryClient();
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: toSettings(settings) });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await saveBillingSettings({ ...v, support_email: v.support_email.trim() || null, support_whatsapp: v.support_whatsapp.trim() || null });
      form.reset(toSettings(saved));
      toast.success(s.saved);
      await client.invalidateQueries({ queryKey: ["admin", "plans"] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const number = { valueAsNumber: true } as const;
  return (
    <form onSubmit={submit} noValidate>
      <Panel>
        <PanelHeader title={s.title} />
        <PanelBody className="flex flex-col gap-4">
          <Controller control={form.control} name="trial_enabled" render={({ field }) => <SwitchRow title={s.trialEnabled} description={s.trialEnabledHint} checked={field.value} onCheckedChange={field.onChange} />} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={s.trialDays} htmlFor="trial-days" error={errors.trial_days?.message}>
              <Input id="trial-days" type="number" inputMode="numeric" dir="ltr" className="tabular" {...form.register("trial_days", number)} />
            </Field>
            <Field label={s.trialPlan}>
              <Controller
                control={form.control}
                name="trial_plan_key"
                render={({ field }) => <Select aria-label={s.trialPlan} value={field.value} onValueChange={field.onChange} options={plans.filter((p) => !p.is_archived).map((p) => ({ value: p.key, label: p.name }))} searchable={false} />}
              />
            </Field>
          </div>
          <Field label={s.graceHours} htmlFor="grace-hours" hint={s.graceHoursHint} error={errors.grace_hours?.message}>
            <Input id="grace-hours" type="number" inputMode="numeric" dir="ltr" className="tabular" {...form.register("grace_hours", number)} />
          </Field>
          <Field label={s.invoiceHours} htmlFor="invoice-hours" error={errors.invoice_hours?.message}>
            <Input id="invoice-hours" type="number" inputMode="numeric" dir="ltr" className="tabular" {...form.register("invoice_hours", number)} />
          </Field>
          <Field label={s.supportEmail} htmlFor="support-email" hint={s.supportHint} error={errors.support_email?.message}>
            <Input id="support-email" type="email" dir="ltr" {...form.register("support_email")} />
          </Field>
          <Field label={s.supportWhatsapp} htmlFor="support-whatsapp" error={errors.support_whatsapp?.message}>
            <Input id="support-whatsapp" dir="ltr" inputMode="tel" className="tabular" {...form.register("support_whatsapp")} />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      </Panel>
    </form>
  );
}
