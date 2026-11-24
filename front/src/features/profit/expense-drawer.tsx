"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DatePicker } from "@/components/forms/date-pickers";
import { MoneyInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { saveExpense, useProfitSettings, useRefreshProfit, type Expense, type ExpenseKind } from "./api";

const t = ar.profit.expenses;

const schema = z.object({
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ar.validation.required),
  kind: z.string().min(1, ar.validation.required),
  amount: z.string().refine((s) => /^\d{1,7}(\.\d{1,2})?$/.test(s) && Number(s) > 0, ar.validation.required),
  note: z.string().max(200, ar.validation.max(200)),
});

type Values = z.infer<typeof schema>;
const FIELDS = ["spent_on", "kind", "amount", "note"] as const;

export type ExpenseDrawerState = { mode: "create" } | { mode: "edit"; expense: Expense } | null;

/** Today in Cairo, «YYYY-MM-DD». */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

export function ExpenseDrawer({ state, onClose }: { state: ExpenseDrawerState; onClose: () => void }) {
  return (
    <Drawer open={state !== null} onOpenChange={(o) => !o && onClose()} title={state?.mode === "edit" ? t.editTitle : t.newTitle}>
      {state ? <ExpenseForm key={state.mode === "edit" ? state.expense.id : "new"} expense={state.mode === "edit" ? state.expense : null} onDone={onClose} /> : null}
    </Drawer>
  );
}

function ExpenseForm({ expense, onDone }: { expense: Expense | null; onDone: () => void }) {
  const settings = useProfitSettings();
  const refresh = useRefreshProfit();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { spent_on: expense?.spent_on ?? today(), kind: expense?.kind ?? "ads_facebook", amount: expense ? String(expense.amount) : "", note: expense?.note ?? "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(v: Values) {
    setFormError(null);
    try {
      await saveExpense({ spent_on: v.spent_on, kind: v.kind as ExpenseKind, amount: v.amount, note: v.note.trim() || null }, expense?.id);
      toast.success(expense ? t.saved : t.created);
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
      <Field label={t.day} htmlFor="expense-day" error={errors.spent_on?.message} required>
        <Controller control={form.control} name="spent_on" render={({ field }) => <DatePicker id="expense-day" value={field.value} onChange={field.onChange} invalid={!!errors.spent_on} />} />
      </Field>
      <Field label={t.kind} error={errors.kind?.message} required>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => <Select aria-label={t.kind} value={field.value} onValueChange={field.onChange} options={(settings.data?.kinds ?? []).map((k) => ({ value: k.value, label: k.label }))} />}
        />
      </Field>
      <Field label={t.amount} htmlFor="expense-amount" error={errors.amount?.message} required>
        <Controller control={form.control} name="amount" render={({ field }) => <MoneyInput id="expense-amount" value={field.value} onChange={field.onChange} aria-invalid={!!errors.amount} />} />
      </Field>
      <Field label={t.note} htmlFor="expense-note" error={errors.note?.message}>
        <Input id="expense-note" maxLength={200} placeholder={t.notePlaceholder} {...form.register("note")} />
      </Field>
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
