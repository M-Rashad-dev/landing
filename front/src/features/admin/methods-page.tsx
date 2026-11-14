"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { savePaymentMethod, usePaymentMethods, type PaymentMethod } from "./payments-api";

const t = ar.admin.methods;

export function MethodsPage() {
  const query = usePaymentMethods();
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {query.isPending ? (
        <div className="flex max-w-3xl flex-col gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={CreditCard} title={t.title} />
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          {query.data.map((m) => (
            <MethodCard key={m.key} method={m} onSaved={() => void query.refetch()} />
          ))}
        </div>
      )}
    </>
  );
}

const schema = z
  .object({
    name: z.string().trim().min(1, t.nameRequired).max(60),
    account_label: z.string().max(60),
    account_value: z.string().max(120),
    instructions: z.string().max(1000),
    is_active: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
  })
  .refine((v) => !v.is_active || v.account_value.trim() !== "", { path: ["account_value"], message: t.accountRequired });
type Values = z.infer<typeof schema>;

const toValues = (m: PaymentMethod): Values => ({
  name: m.name,
  account_label: m.account_label ?? "",
  account_value: m.account_value ?? "",
  instructions: m.instructions ?? "",
  is_active: m.is_active,
  sort_order: m.sort_order,
});

function MethodCard({ method, onSaved }: { method: PaymentMethod; onSaved: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(method) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const active = useWatch({ control: form.control, name: "is_active" });
  const id = (field: string) => `${method.key}-${field}`;
  const ready = method.is_active && Boolean(method.account_value);

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await savePaymentMethod(method.key, {
        name: v.name.trim(),
        account_label: v.account_label.trim() || null,
        account_value: v.account_value.trim() || null,
        instructions: v.instructions.trim() || null,
        is_active: v.is_active,
        sort_order: v.sort_order,
      });
      form.reset(toValues(saved));
      toast.success(t.saved);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Panel>
        <PanelHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {method.name}
              <Badge tone={ready ? "success" : "neutral"} size="sm" dot>
                {ready ? t.active : method.is_active ? t.notReady : t.inactive}
              </Badge>
            </span>
          }
          description={t.kind[method.kind] ?? method.kind}
          actions={
            <label className="flex items-center gap-2 text-sm">
              <span className="text-ink-2">{active ? t.active : t.inactive}</span>
              <Controller control={form.control} name="is_active" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`${t.active}: ${method.name}`} />} />
            </label>
          }
        />
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t.name} htmlFor={id("name")} error={errors.name?.message} required>
            <Input id={id("name")} aria-invalid={Boolean(errors.name)} {...form.register("name")} />
          </Field>
          <Field label={t.order} htmlFor={id("order")}>
            <Input id={id("order")} type="number" inputMode="numeric" min={0} max={1000} dir="ltr" className="tabular sm:max-w-28" {...form.register("sort_order", { valueAsNumber: true })} />
          </Field>
          <Field label={t.accountLabel} htmlFor={id("label")} hint={t.accountLabelHint}>
            <Input id={id("label")} {...form.register("account_label")} />
          </Field>
          <Field label={t.accountValue} htmlFor={id("value")} hint={t.accountValueHint} error={errors.account_value?.message} required={active}>
            <Input id={id("value")} dir="ltr" className="tabular" aria-invalid={Boolean(errors.account_value)} {...form.register("account_value")} />
          </Field>
          <Field label={t.instructions} htmlFor={id("instructions")} hint={t.instructionsHint} className="sm:col-span-2">
            <Textarea id={id("instructions")} rows={3} {...form.register("instructions")} />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end gap-2">
          {isDirty ? (
            <Button type="button" variant="ghost" onClick={() => form.reset(toValues(method))}>
              {ar.common.discard}
            </Button>
          ) : null}
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      </Panel>
    </form>
  );
}
