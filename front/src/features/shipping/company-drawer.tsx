"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import * as React from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormSection } from "@/components/forms/form-layout";
import { MoneyInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Switch, SwitchRow } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, InputGroup } from "@/components/ui/input";
import { Drawer } from "@/components/ui/overlay";
import { ImageField } from "@/features/media/image-fields";
import { checkInt, checkMoney, num } from "@/features/promotions/form-utils";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { saveCompany, useRefreshShipping, type Company } from "./api";

const t = ar.shipping.form;

const schema = z
  .object({
    name: z.string().trim().min(1, ar.validation.required).max(60, ar.validation.max(60)),
    logo: z.object({ id: z.number(), url: z.string() }).nullable(),
    delivery_days_min: z.string(),
    delivery_days_max: z.string(),
    default_fee: z.string(),
    is_active: z.boolean(),
    rates: z.array(z.object({ governorate: z.string(), fee: z.string(), is_available: z.boolean() })),
  })
  .superRefine((v, ctx) => {
    checkInt(ctx, "delivery_days_min", v.delivery_days_min, 0, 60, false);
    checkInt(ctx, "delivery_days_max", v.delivery_days_max, 0, 60, false);
    const min = num(v.delivery_days_min);
    const max = num(v.delivery_days_max);
    if (min !== null && max !== null && max < min) ctx.addIssue({ code: "custom", path: ["delivery_days_max"], message: ar.validation.between(min, 60) });
    checkMoney(ctx, "default_fee", v.default_fee, { allowZero: true });
    v.rates.forEach((r, i) => r.is_available && checkMoney(ctx, `rates.${i}.fee`, r.fee, { required: false, allowZero: true }));
  });

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "media_id", "delivery_days_min", "delivery_days_max", "default_fee", "is_active", "rates"] as const;

export type CompanyDrawerState = { mode: "create" } | { mode: "edit"; company: Company } | null;

export function CompanyDrawer({ state, governorates, onClose }: { state: CompanyDrawerState; governorates: string[]; onClose: () => void }) {
  return (
    <Drawer open={state !== null} onOpenChange={(o) => !o && onClose()} title={state?.mode === "edit" ? t.editTitle : t.newTitle} width="lg">
      {state ? <CompanyForm key={state.mode === "edit" ? state.company.id : "new"} company={state.mode === "edit" ? state.company : null} governorates={governorates} onDone={onClose} /> : null}
    </Drawer>
  );
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function CompanyForm({ company, governorates, onDone }: { company: Company | null; governorates: string[]; onDone: () => void }) {
  const refresh = useRefreshShipping();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const saved = new Map((company?.rates ?? []).map((r) => [r.governorate, r]));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? "",
      logo: company?.logo && company.media_id ? { id: company.media_id, url: company.logo.thumb } : null,
      delivery_days_min: str(company?.delivery_days_min),
      delivery_days_max: str(company?.delivery_days_max),
      default_fee: str(company?.default_fee),
      is_active: company?.is_active ?? true,
      rates: governorates.map((g) => ({ governorate: g, fee: str(saved.get(g)?.fee), is_available: saved.get(g)?.is_available ?? true })),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const rates = useFieldArray({ control: form.control, name: "rates" });
  const watchedRates = useWatch({ control: form.control, name: "rates" });
  const defaultFee = useWatch({ control: form.control, name: "default_fee" });
  const served = watchedRates.filter((r) => r.is_available).length;

  function setAll(patch: Partial<{ fee: string; is_available: boolean }>) {
    form.setValue(
      "rates",
      watchedRates.map((r) => ({ ...r, ...patch })),
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    const body = {
      name: values.name,
      media_id: values.logo?.id ?? null,
      delivery_days_min: num(values.delivery_days_min),
      delivery_days_max: num(values.delivery_days_max),
      default_fee: values.default_fee,
      is_active: values.is_active,
      rates: values.rates.map((r) => ({ governorate: r.governorate, fee: r.is_available && r.fee.trim() !== "" ? r.fee : null, is_available: r.is_available })),
    };
    try {
      await saveCompany(body, company?.id);
      toast.success(company ? t.saved : t.created);
      await refresh();
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  const query = filter.trim();

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label={t.name} htmlFor="company-name" error={errors.name?.message} required>
        <Input id="company-name" autoFocus={!company} placeholder={t.namePlaceholder} aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field label={t.logo} hint={t.logoHint}>
        <Controller control={form.control} name="logo" render={({ field }) => <ImageField value={field.value} onChange={(m) => field.onChange(m ? { id: m.id, url: m.urls.thumb } : null)} />} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.defaultFee} htmlFor="company-fee" hint={t.defaultFeeHint} error={errors.default_fee?.message} required>
          <Controller control={form.control} name="default_fee" render={({ field }) => <MoneyInput id="company-fee" value={field.value} onChange={field.onChange} aria-invalid={!!errors.default_fee} />} />
        </Field>
        <Field label={t.days} hint={t.daysHint} error={errors.delivery_days_min?.message ?? errors.delivery_days_max?.message}>
          <div className="flex items-center gap-2">
            <Input aria-label={t.daysMin} placeholder={t.daysMin} inputMode="numeric" aria-invalid={!!errors.delivery_days_min} {...form.register("delivery_days_min")} />
            <span className="text-ink-3">–</span>
            <Input aria-label={t.daysMax} placeholder={t.daysMax} inputMode="numeric" aria-invalid={!!errors.delivery_days_max} {...form.register("delivery_days_max")} />
          </div>
        </Field>
      </div>

      <FormSection title={`${t.governorates} (${ar.shipping.served(served, governorates.length)})`} description={t.governoratesHint}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <InputGroup start={<Search />} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.searchGovernorate} aria-label={t.searchGovernorate} className="sm:w-56" />
          <div className="flex flex-wrap gap-1.5 sm:ms-auto">
            <Button type="button" size="sm" variant="secondary" onClick={() => setAll({ is_available: true })}>
              {t.openAll}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAll({ is_available: false })}>
              {t.closeAll}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAll({ fee: "" })}>
              {t.resetFees}
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_auto_8.5rem] items-center gap-3 border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium text-ink-3">
            <span>{t.governorate}</span>
            <span>{t.serves}</span>
            <span>{t.fee}</span>
          </div>
          <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
            {rates.fields.map((row, i) => {
              const current = watchedRates[i];
              if (query && !row.governorate.includes(query)) return null;
              const error = errors.rates?.[i]?.fee?.message;
              return (
                <li key={row.id} className="grid grid-cols-[1fr_auto_8.5rem] items-center gap-3 px-3 py-1.5">
                  <span className={current?.is_available ? "text-sm" : "text-sm text-ink-3 line-through"}>{row.governorate}</span>
                  <Controller control={form.control} name={`rates.${i}.is_available`} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`${t.serves}: ${row.governorate}`} />} />
                  {current?.is_available ? (
                    <Controller
                      control={form.control}
                      name={`rates.${i}.fee`}
                      render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} placeholder={t.feePlaceholder(defaultFee)} aria-label={`${t.fee}: ${row.governorate}`} aria-invalid={!!error} title={error} className="h-8" />}
                    />
                  ) : (
                    <span className="text-xs text-ink-3">{t.notServed}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </FormSection>

      <Controller control={form.control} name="is_active" render={({ field }) => <SwitchRow title={ar.promotions.active} checked={field.value} onCheckedChange={field.onChange} />} />

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
