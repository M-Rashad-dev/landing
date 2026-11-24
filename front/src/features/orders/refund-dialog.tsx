"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FileDrop, MoneyInput, QuantityStepper } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCards } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { createRefund, REFUND_METHODS, type OrderDetail, type RefundMethod } from "./api";

const t = ar.refunds.dialog;
const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

type Scope = "all" | "items" | "amount";

function schema(max: number) {
  return z
    .object({
      scope: z.enum(["all", "items", "amount"]),
      quantities: z.record(z.string(), z.number().int().min(0)),
      amount: z.string().trim().min(1, t.amountRequired),
      method: z.enum(["original", "wallet", "instapay", "bank", "cash"]),
      destination: z.string().max(120),
      reason: z.string().max(300),
      restock: z.boolean(),
      revoke: z.boolean(),
      done: z.boolean(),
      reference: z.string().max(120),
    })
    .superRefine((v, ctx) => {
      const amount = Number(v.amount);
      if (!(amount > 0)) ctx.addIssue({ code: "custom", path: ["amount"], message: t.amountRequired });
      else if (Math.round(amount * 100) > Math.round(max * 100)) ctx.addIssue({ code: "custom", path: ["amount"], message: t.amountMax(formatMoney(max)) });
      if (v.scope === "items" && !Object.values(v.quantities).some((q) => q > 0)) ctx.addIssue({ code: "custom", path: ["quantities"], message: t.pickItem });
    });
}
type Values = z.infer<ReturnType<typeof schema>>;

/** «رد مبلغ»: the whole amount, some lines (amount suggested from them), or just an amount; asked or already sent. */
export function RefundDialog({ order, open, onOpenChange, onSaved }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted on open: every opening starts clean. */}
      {open ? <RefundForm order={order} onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

/** What is left of each line, with its unit price after the line's offer. */
function linesLeft(order: OrderDetail) {
  return order.items
    .map((item) => ({ item, left: order.refunds.items_left[String(item.id)] ?? 0, unit: item.quantity > 0 ? item.line_total / item.quantity : 0 }))
    .filter((l) => l.left > 0);
}

/** The amount for the chosen lines (never above what can still go back). */
export function suggestedAmount(order: OrderDetail, scope: Scope, quantities: Record<string, number>): number {
  const max = order.refunds.refundable;
  if (scope === "all") return max;
  if (scope === "amount") return 0;
  const sum = linesLeft(order).reduce((acc, l) => acc + l.unit * (quantities[String(l.item.id)] ?? 0), 0);
  return Math.min(max, Math.round(sum * 100) / 100);
}

function RefundForm({ order, onOpenChange, onSaved }: { order: OrderDetail; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  const r = order.refunds;
  const lines = linesLeft(order);
  const [proof, setProof] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema(r.refundable)),
    defaultValues: {
      scope: "all",
      quantities: {},
      amount: String(r.refundable),
      method: "original",
      destination: r.default_destination ?? "",
      reason: "",
      restock: false,
      revoke: false,
      done: false,
      reference: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [scope, quantities, done] = useWatch({ control: form.control, name: ["scope", "quantities", "done"] });

  // The lines the refund carries: all that are left («كله»), the chosen ones, or none (an amount only).
  const chosen = scope === "all" ? lines.map((l) => ({ ...l, qty: l.left })) : scope === "items" ? lines.map((l) => ({ ...l, qty: quantities[String(l.item.id)] ?? 0 })).filter((l) => l.qty > 0) : [];
  const hasPhysical = chosen.some((l) => !l.item.delivery_type);
  const hasDigital = chosen.some((l) => !!l.item.delivery_type);

  const pickScope = (next: Scope) => {
    form.setValue("scope", next);
    form.setValue("amount", next === "amount" ? "" : String(suggestedAmount(order, next, quantities)));
  };
  const setQty = (id: number, qty: number) => {
    const next = { ...quantities, [String(id)]: qty };
    form.setValue("quantities", next, { shouldValidate: form.formState.isSubmitted });
    form.setValue("amount", String(suggestedAmount(order, "items", next)));
  };

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const refund = await createRefund(order.id, {
        amount: values.amount,
        method: values.method,
        items: chosen.map((l) => ({ order_item_id: l.item.id, quantity: l.qty })),
        reason: values.reason.trim() || undefined,
        destination: values.destination.trim() || undefined,
        restock: hasPhysical && values.restock,
        revoke_digital: hasDigital && values.revoke,
        done: values.done,
        reference: values.done ? values.reference.trim() || undefined : undefined,
        proof: values.done ? proof : null,
      });
      toast.success(refund.status === "done" ? t.done : t.created);
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["amount", "method", "destination", "reason", "reference"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <DialogContent size="lg">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <DialogHeader title={t.title} description={t.description(formatMoney(r.refundable))} />
        <DialogBody className="flex flex-col gap-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Field label={t.scope}>
            <RadioCards
              className="sm:grid-cols-3"
              value={scope}
              onValueChange={(v) => pickScope(v as Scope)}
              options={[
                { value: "all", title: t.all },
                { value: "items", title: t.items, disabled: lines.length === 0 },
                { value: "amount", title: t.amountOnly },
              ]}
            />
          </Field>

          {scope === "items" ? (
            <Field label={t.itemsLabel} hint={t.itemsHint} error={(errors.quantities as { message?: string } | undefined)?.message}>
              {lines.length === 0 ? (
                <p className="text-sm text-ink-2">{t.noItemsLeft}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lines.map(({ item, left, unit }) => {
                    const qty = quantities[String(item.id)] ?? 0;
                    return (
                      <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm">
                        <Checkbox aria-label={item.product_name} checked={qty > 0} onCheckedChange={(v) => setQty(item.id, v === true ? left : 0)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.product_name}</span>
                          <span className="text-xs text-ink-3">
                            {formatMoney(unit)} × {left}
                          </span>
                        </span>
                        {qty > 0 && left > 1 ? <QuantityStepper value={qty} min={1} max={left} onChange={(n) => setQty(item.id, n)} /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.amount} htmlFor="refund-amount" hint={t.amountHint} error={errors.amount?.message} required>
              <Controller control={form.control} name="amount" render={({ field }) => <MoneyInput id="refund-amount" value={field.value} onChange={field.onChange} aria-invalid={!!errors.amount} />} />
            </Field>
            <Field label={t.method} htmlFor="refund-method" required>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Select
                    id="refund-method"
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as RefundMethod)}
                    options={REFUND_METHODS.map((m) => ({ value: m, label: m === "original" ? r.method_name : ar.refunds.methods[m] }))}
                  />
                )}
              />
            </Field>
          </div>
          <Field label={t.destination} htmlFor="refund-destination" hint={t.destinationHint} error={errors.destination?.message} optional>
            <Input id="refund-destination" dir="ltr" maxLength={120} {...form.register("destination")} />
          </Field>
          <Field label={t.reason} htmlFor="refund-reason" error={errors.reason?.message} optional>
            <Textarea id="refund-reason" rows={2} maxLength={300} {...form.register("reason")} />
          </Field>

          {hasPhysical ? (
            <label className="flex items-center gap-2 text-sm">
              <Controller control={form.control} name="restock" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />} />
              {t.restock}
            </label>
          ) : null}
          {hasDigital ? (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm">
                <Controller control={form.control} name="revoke" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />} />
                {t.revoke}
              </label>
              <p className="ps-6 text-xs text-ink-3">{t.revokeHint}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Controller control={form.control} name="done" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />} />
              {t.alreadySent}
            </label>
            <p className="ps-6 text-xs text-ink-3">{t.alreadySentHint}</p>
            {done ? (
              <div className="mt-2 grid gap-3">
                <Field label={t.reference} htmlFor="refund-reference" error={errors.reference?.message} optional>
                  <Input id="refund-reference" dir="ltr" maxLength={120} {...form.register("reference")} />
                </Field>
                <Field label={t.proof} hint={t.proofHint} optional>
                  <FileDrop accept={PROOF_ACCEPT} file={proof} onFile={setProof} />
                </Field>
              </div>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {t.submit}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
