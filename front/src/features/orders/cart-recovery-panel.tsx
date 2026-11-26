"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, MessageCircle, Settings2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { MoneyInput } from "@/components/forms/inputs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Drawer } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.orders.recovery;

/** back end: Dashboard\CartRecoveryController */
export type RecoveryState = {
  whatsapp_available: boolean;
  enabled: boolean;
  whatsapp: boolean;
  email: boolean;
  first_minutes: number;
  second_hours: number | null;
  coupon_mode: "none" | "code" | "generated";
  discount_code_id: number | null;
  coupon_type: "percentage" | "fixed";
  coupon_value: number | null;
  codes: Array<{ id: number; code: string }>;
  balance: number;
  packs: Array<{ messages: number; price: number }>;
  pending: { id: number; number: string; status: string; messages: number } | null;
  quiet_hours: { from: number; to: number };
  stats: { reminders: number; whatsapp: number; email: number; recovered: number; revenue: number };
};

const KEY = ["cart-recovery"] as const;
const FIRST = [30, 60, 120, 180, 360] as const;
const SECOND = ["none", "6", "12", "24", "48"] as const;

export function CartRecoveryPanel() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<RecoveryState>("/dashboard/leads/recovery") });
  const can = useCan();
  const [editing, setEditing] = React.useState(false);

  if (query.isPending) return <Skeleton className="mb-4 h-32 rounded-xl" />;
  if (query.isError) return <ErrorState className="mb-4" onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const s = query.data;
  const canEdit = can("abandoned.recovery");
  const canBuy = can("billing.pay");

  return (
    <Panel className="mb-4">
      <PanelBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
            <BellRing className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {t.title}
              <Badge tone={s.enabled ? "success" : "neutral"} size="sm">
                {s.enabled ? t.on : t.off}
              </Badge>
            </p>
            <p className="text-sm text-ink-2">{s.enabled ? t.summary(s.first_minutes, s.second_hours, s.whatsapp, s.email) : t.description}</p>
          </div>
          {canEdit ? (
            <Button type="button" size="sm" variant={s.enabled ? "outline" : "primary"} onClick={() => setEditing(true)}>
              <Settings2 aria-hidden /> {s.enabled ? t.edit : t.turnOn}
            </Button>
          ) : null}
        </div>

        {s.enabled && s.whatsapp && !s.whatsapp_available ? <Alert tone="info">{t.whatsappPending}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Metric label={t.stats.reminders} value={formatNumber(s.stats.reminders)} />
            <Metric label={t.stats.recovered} value={formatNumber(s.stats.recovered)} />
            <Metric label={t.stats.revenue} value={formatMoney(s.stats.revenue)} />
          </dl>
          <MessageBalance state={s} canBuy={canBuy} className="rounded-lg border border-border p-3 sm:w-72" />
        </div>
      </PanelBody>
      <Drawer open={editing} onOpenChange={setEditing} title={t.settingsTitle}>
        {editing ? <RecoveryForm state={s} onDone={() => setEditing(false)} /> : null}
      </Drawer>
    </Panel>
  );
}

/** The store's WhatsApp message balance (cart reminders), a pack waiting for review, or packs to buy. */
export function MessageBalance({ state: s, canBuy, className }: { state: Pick<RecoveryState, "balance" | "pending" | "packs">; canBuy: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-center gap-2 text-sm">
        <MessageCircle className="size-4 text-ink-3" aria-hidden />
        <span className="flex-1">{t.balance}</span>
        <span className={s.balance <= LOW_BALANCE ? "tabular font-semibold text-danger" : "tabular font-semibold"}>{t.messages(s.balance)}</span>
      </p>
      {s.balance <= LOW_BALANCE && !s.pending ? <p className="text-xs font-semibold text-danger">{s.balance === 0 ? t.balanceEmpty : t.balanceLow}</p> : null}
      {s.pending ? (
        <p className="text-xs text-ink-3">
          {t.pending(s.pending.messages)}{" "}
          <Link className="text-brand-strong hover:underline" href={`/dashboard/settings/billing/invoices/${s.pending.id}`}>
            {s.pending.number}
          </Link>
        </p>
      ) : canBuy && s.packs.length > 0 ? (
        <BuyPacks packs={s.packs} />
      ) : null}
      <p className="text-xs text-ink-3">{t.balanceHint}</p>
    </div>
  );
}

/** The balance turns red and says so at this many messages or fewer. */
const LOW_BALANCE = 20;

/** The balance and packs on their own (billing page): read from the cart reminders state. */
export function MessageBalancePanel() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<RecoveryState>("/dashboard/leads/recovery") });
  const can = useCan();
  return (
    <Panel>
      <PanelHeader title={t.balance} description={t.balancePanelHint} />
      <PanelBody>
        {query.isPending ? (
          <Skeleton className="h-20" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : (
          <MessageBalance state={query.data} canBuy={can("billing.pay")} />
        )}
      </PanelBody>
    </Panel>
  );
}

function BuyPacks({ packs }: { packs: RecoveryState["packs"] }) {
  const [chosen, setChosen] = React.useState(String(packs[Math.min(1, packs.length - 1)].messages));
  return (
    <div className="flex items-center gap-2">
      <Select aria-label={t.pack} value={chosen} onValueChange={setChosen} options={packs.map((p) => ({ value: String(p.messages), label: t.packLabel(p.messages, formatMoney(p.price)) }))} searchable={false} className="flex-1" />
      <Button asChild size="sm">
        <Link href={`/dashboard/settings/billing/checkout?messages=${chosen}`}>{t.buy}</Link>
      </Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2/60 p-2.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tabular font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}

const schema = z
  .object({
    enabled: z.boolean(),
    whatsapp: z.boolean(),
    email: z.boolean(),
    first_minutes: z.string(),
    second_hours: z.string(),
    coupon_mode: z.enum(["none", "code", "generated"]),
    discount_code_id: z.string(),
    coupon_type: z.enum(["percentage", "fixed"]),
    coupon_value: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.coupon_mode === "code" && !v.discount_code_id) ctx.addIssue({ code: "custom", path: ["discount_code_id"], message: ar.validation.required });
    const value = Number(v.coupon_value);
    if (v.coupon_mode === "generated" && (!(value > 0) || (v.coupon_type === "percentage" && value > 90))) ctx.addIssue({ code: "custom", path: ["coupon_value"], message: ar.validation.between(1, 90) });
  });
type Values = z.infer<typeof schema>;
const FIELDS = ["enabled", "whatsapp", "email", "first_minutes", "second_hours", "coupon_mode", "discount_code_id", "coupon_type", "coupon_value"] as const;

export function RecoveryForm({ state, onDone }: { state: RecoveryState; onDone: () => void }) {
  const client = useQueryClient();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Opening the settings is to turn it on (or keep it on).
      enabled: true,
      whatsapp: state.whatsapp,
      email: state.email,
      first_minutes: String(state.first_minutes),
      second_hours: state.second_hours === null ? "none" : String(state.second_hours),
      coupon_mode: state.coupon_mode,
      discount_code_id: state.discount_code_id ? String(state.discount_code_id) : "",
      coupon_type: state.coupon_type,
      coupon_value: state.coupon_value === null ? "" : String(state.coupon_value),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [second, mode, type] = useWatch({ control: form.control, name: ["second_hours", "coupon_mode", "coupon_type"] });

  async function onSubmit(v: Values) {
    setFormError(null);
    try {
      const saved = await api<RecoveryState>("/dashboard/leads/recovery", {
        method: "PUT",
        body: {
          enabled: v.enabled,
          whatsapp: v.whatsapp,
          email: v.email,
          first_minutes: Number(v.first_minutes),
          second_hours: v.second_hours === "none" ? null : Number(v.second_hours),
          coupon_mode: v.second_hours === "none" ? "none" : v.coupon_mode,
          discount_code_id: v.coupon_mode === "code" && v.discount_code_id ? Number(v.discount_code_id) : null,
          coupon_type: v.coupon_type,
          coupon_value: v.coupon_mode === "generated" ? v.coupon_value : null,
        },
      });
      client.setQueryData(KEY, saved);
      toast.success(t.saved);
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Controller control={form.control} name="enabled" render={({ field }) => <SwitchRow title={t.enabled} description={t.enabledHint} checked={field.value} onCheckedChange={field.onChange} />} />
      <Controller control={form.control} name="whatsapp" render={({ field }) => <SwitchRow title={t.whatsapp} description={t.whatsappHint} checked={field.value} onCheckedChange={field.onChange} />} />
      <Controller control={form.control} name="email" render={({ field }) => <SwitchRow title={t.email} description={t.emailHint} checked={field.value} onCheckedChange={field.onChange} />} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.first} hint={t.firstHint}>
          <Controller control={form.control} name="first_minutes" render={({ field }) => <Select aria-label={t.first} value={field.value} onValueChange={field.onChange} options={FIRST.map((m) => ({ value: String(m), label: t.after(m) }))} searchable={false} />} />
        </Field>
        <Field label={t.second} hint={t.secondHint}>
          <Controller control={form.control} name="second_hours" render={({ field }) => <Select aria-label={t.second} value={field.value} onValueChange={field.onChange} options={SECOND.map((h) => ({ value: h, label: h === "none" ? t.noSecond : t.afterHours(Number(h)) }))} searchable={false} />} />
        </Field>
      </div>
      {second !== "none" ? (
        <Field label={t.coupon}>
          <Controller
            control={form.control}
            name="coupon_mode"
            render={({ field }) => (
              <RadioCards
                value={field.value}
                onValueChange={field.onChange}
                className="sm:grid-cols-3"
                options={(["none", "generated", "code"] as const).map((m) => ({ value: m, title: t.couponModes[m].title, description: t.couponModes[m].description }))}
              />
            )}
          />
        </Field>
      ) : null}
      {second !== "none" && mode === "code" ? (
        <Field label={t.code} error={errors.discount_code_id?.message} hint={state.codes.length === 0 ? t.noCodes : undefined}>
          <Controller control={form.control} name="discount_code_id" render={({ field }) => <Select aria-label={t.code} value={field.value} onValueChange={field.onChange} options={state.codes.map((c) => ({ value: String(c.id), label: c.code }))} emptyLabel={t.pickCode} />} />
        </Field>
      ) : null}
      {second !== "none" && mode === "generated" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.couponType}>
            <Controller
              control={form.control}
              name="coupon_type"
              render={({ field }) => <Select aria-label={t.couponType} value={field.value} onValueChange={field.onChange} options={[{ value: "percentage", label: t.percentage }, { value: "fixed", label: t.fixed }]} searchable={false} />}
            />
          </Field>
          <Field label={type === "percentage" ? t.percentValue : t.fixedValue} htmlFor="coupon-value" hint={t.generatedHint} error={errors.coupon_value?.message}>
            <Controller control={form.control} name="coupon_value" render={({ field }) => <MoneyInput id="coupon-value" value={field.value} onChange={field.onChange} aria-invalid={!!errors.coupon_value} />} />
          </Field>
        </div>
      ) : null}
      <Alert tone="info">{t.rules(state.quiet_hours.from, state.quiet_hours.to)}</Alert>
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
