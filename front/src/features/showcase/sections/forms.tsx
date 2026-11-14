"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Price } from "@/components/data/details";
import { FormLayout, FormSection, SaveBar, useUnsavedWarning } from "@/components/forms/form-layout";
import { MoneyInput } from "@/components/forms/inputs";
import { Badge } from "@/components/ui/badge";
import { SwitchRow } from "@/components/ui/choice";
import { toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, Thumb } from "@/components/ui/panel";
import { ar } from "@/messages/ar";
import { DEMO_THUMB } from "../fixtures";
import { ShowSection } from "../frame";

const t = ar.showcase.forms;
const money = /^\d{1,7}(\.\d{1,2})?$/;

const schema = z
  .object({
    name: z.string().trim().min(2, ar.showcase.inputs.errorText).max(150),
    price: z.string().regex(money, ar.showcase.inputs.errorText),
    compare: z.string().refine((v) => v === "" || money.test(v), ar.showcase.inputs.errorText),
    stock: z.string().regex(/^\d{0,7}$/),
    active: z.boolean(),
  })
  .refine((v) => v.compare === "" || Number(v.compare) > Number(v.price), { path: ["compare"], message: t.compareError });

type Values = z.infer<typeof schema>;

const initial: Values = { name: "قميص كتان", price: "300", compare: "380", stock: "12", active: true };

/** A real react-hook-form + zod form: sections, side preview, sticky save bar, field errors. */
export function FormsSection() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial, mode: "onTouched" });
  const { register, control, formState, handleSubmit, reset, setError } = form;
  const values = useWatch({ control });
  useUnsavedWarning(formState.isDirty);

  async function onSubmit(v: Values) {
    await new Promise((r) => setTimeout(r, 600));
    if (v.name.trim() === "خطأ") {
      // How a server validation error lands on its field.
      setError("name", { message: t.serverError });
      return;
    }
    reset(v);
    toast.success(t.saved);
  }

  return (
    <ShowSection id="forms" title={ar.showcase.sections.forms.title} description={ar.showcase.sections.forms.description}>
      <p className="text-xs text-ink-3">{t.makeChange}</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormLayout
          aside={
            <Panel>
              <PanelHeader title={t.asideTitle} />
              <PanelBody className="flex gap-3">
                <Thumb src={DEMO_THUMB} size={72} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{values.name || "—"}</p>
                  <Price value={Number(values.price) || 0} compareAt={values.compare ? Number(values.compare) : null} size="sm" />
                  <div className="mt-2">{values.active ? <Badge tone="success" dot>{ar.domain.productState.active}</Badge> : <Badge dot>{ar.domain.productState.inactive}</Badge>}</div>
                </div>
              </PanelBody>
            </Panel>
          }
        >
          <FormSection title={t.basics} hasError={Boolean(formState.errors.name)}>
            <Field label={t.name} htmlFor="f-name" required error={formState.errors.name?.message}>
              <Input id="f-name" aria-invalid={Boolean(formState.errors.name)} {...register("name")} />
            </Field>
            <Controller control={control} name="active" render={({ field }) => <SwitchRow title={ar.showcase.inputs.switch} description={ar.showcase.inputs.switchHint} checked={field.value} onCheckedChange={field.onChange} />} />
          </FormSection>
          <FormSection title={t.pricing} description={t.pricingHint} hasError={Boolean(formState.errors.price || formState.errors.compare)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.price} htmlFor="f-price" required error={formState.errors.price?.message}>
                <Controller control={control} name="price" render={({ field }) => <MoneyInput id="f-price" value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-invalid={Boolean(formState.errors.price)} />} />
              </Field>
              <Field label={t.compare} htmlFor="f-compare" optional error={formState.errors.compare?.message}>
                <Controller control={control} name="compare" render={({ field }) => <MoneyInput id="f-compare" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />
              </Field>
            </div>
          </FormSection>
          <FormSection title={t.stock} description={t.collapsed} collapsible defaultOpen={false}>
            <Field label={t.stockQty} htmlFor="f-stock">
              <Input id="f-stock" dir="ltr" inputMode="numeric" className="tabular w-32 text-start" {...register("stock")} />
            </Field>
          </FormSection>
        </FormLayout>
        <SaveBar visible={formState.isDirty} saving={formState.isSubmitting} onSave={handleSubmit(onSubmit)} onDiscard={() => reset(initial)} />
      </form>
    </ShowSection>
  );
}
