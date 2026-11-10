"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Crown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Meter } from "@/components/billing/plan";
import { ErrorState } from "@/components/dashboard/error-state";
import { DateTimeField } from "@/components/forms/datetime-field";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { adminKeys, deleteOverride, extendPlan, grantPlan, planKeys, setOverride, useAdminPlans, useTenantBilling, type TenantBilling } from "@/lib/admin/api";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { PLAN_FEATURES, type EntitlementInfo } from "@/lib/billing/types";
import { formatCairo, fromCairoInputValue } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.admin.tenantBilling;
const b = ar.billing;

function toastError(error: unknown, unmatched: string[] = []) {
  if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
}

export function TenantBillingCard({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useTenantBilling(id);
  const plans = useAdminPlans();
  const [dialog, setDialog] = useState<"grant" | "extend" | "override" | null>(null);

  const store = (next: TenantBilling) => {
    queryClient.setQueryData(planKeys.tenantBilling(id), next);
    void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    void queryClient.invalidateQueries({ queryKey: planKeys.all });
  };

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-64 rounded-xl" />;

  const entitlements = plans.data?.entitlements ?? [];
  const label = (key: string) => entitlements.find((e) => e.key === key)?.label ?? key;
  const tone = data.state === "active" ? "success" : data.state === "grace" ? "warning" : "destructive";

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Crown className="size-5 text-gold" aria-hidden />
          {t.title}: {data.plan?.name ?? t.noPlan}
          <Badge variant={tone}>{b.state[data.state]}</Badge>
          {data.is_trial ? <Badge variant="info">{t.trial}</Badge> : null}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog("extend")} disabled={data.state === "expired"}>
            <CalendarPlus />
            {t.extend}
          </Button>
          <Button size="sm" onClick={() => setDialog("grant")}>
            <Crown />
            {t.grant}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {data.ends_at ? <p className="text-sm text-muted-foreground">{b.plan.endsAt(formatCairo(data.ends_at))}</p> : null}
          <div>
            <p className="mb-3 font-semibold">{t.usage}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.usage.map((row) => (
                <Meter key={row.key} label={row.label} used={row.used} limit={row.limit} unlimited={row.unlimited} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">{t.overrides}</p>
              <Button size="sm" variant="outline" onClick={() => setDialog("override")}>
                <Plus />
                {t.addOverride}
              </Button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{t.overridesHint}</p>
            {data.overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noOverrides}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.overrides.map((o) => (
                  <li key={o.entitlement} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                    <span>
                      <span className="font-semibold">{label(o.entitlement)}</span>:{" "}
                      {(PLAN_FEATURES as readonly string[]).includes(o.entitlement) ? (o.value ? t.on : t.off) : o.value === null ? b.unlimited : o.value}
                      <span className="block text-xs text-muted-foreground">
                        {o.reason}
                        {o.expires_at ? ` · ${formatCairo(o.expires_at)}` : ""}
                      </span>
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={ar.common.delete}
                      onClick={async () => {
                        try {
                          await deleteOverride(id, o.entitlement);
                          await refetch();
                          toast.success(t.overrideDeleted);
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <p className="mb-3 font-semibold">{t.history}</p>
          {data.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noHistory}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.subscriptions.map((s) => (
                <li key={s.id} className="rounded-lg border p-2 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.plan_name}
                    <Badge variant="secondary">{b.sources[s.source]}</Badge>
                    {s.status !== "active" ? <Badge variant="outline">{b.statuses[s.status]}</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCairo(s.starts_at, { withTime: false })} ← {formatCairo(s.ends_at, { withTime: false })}
                    {s.amount_paid > 0 ? ` · ${formatPrice(s.amount_paid)}` : ""}
                    {s.note ? ` · ${s.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>

      <GrantDialog open={dialog === "grant"} onClose={() => setDialog(null)} id={id} plans={(plans.data?.plans ?? []).map((p) => ({ value: p.key, label: p.name }))} onSaved={store} />
      <ExtendDialog open={dialog === "extend"} onClose={() => setDialog(null)} id={id} onSaved={store} />
      <OverrideDialog open={dialog === "override"} onClose={() => setDialog(null)} id={id} entitlements={entitlements} onSaved={store} />
    </Card>
  );
}

const grantSchema = z.object({ plan_key: z.string().min(1, ar.validation.required), days: z.coerce.number().int().min(1).max(3650), note: z.string().max(500) });

function GrantDialog({ open, onClose, id, plans, onSaved }: { open: boolean; onClose: () => void; id: number; plans: { value: string; label: string }[]; onSaved: (data: TenantBilling) => void }) {
  const form = useForm<z.input<typeof grantSchema>, unknown, z.output<typeof grantSchema>>({ resolver: zodResolver(grantSchema), defaultValues: { plan_key: "", days: 30, note: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.output<typeof grantSchema>) {
    try {
      onSaved(await grantPlan(id, { ...values, note: values.note.trim() || null }));
      toast.success(t.granted);
      form.reset();
      onClose();
    } catch (error) {
      toastError(error, applyServerErrors(error, form.setError, ["plan_key", "days", "note"]));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !isSubmitting ? onClose() : undefined)}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t.grantTitle}</DialogTitle>
            <DialogDescription>{t.grantText}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FormField label={t.plan} htmlFor="grant-plan" error={errors.plan_key?.message} required>
              <Controller control={form.control} name="plan_key" render={({ field }) => <Select id="grant-plan" options={plans} value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder="—" />} />
            </FormField>
            <FormField label={t.days} htmlFor="grant-days" error={errors.days?.message} required>
              <Input id="grant-days" type="number" dir="ltr" min={1} max={3650} {...form.register("days")} />
            </FormField>
            <FormField label={t.note} htmlFor="grant-note" error={errors.note?.message} optional>
              <Input id="grant-note" {...form.register("note")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.grant}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const extendSchema = z.object({ days: z.coerce.number().int().min(1).max(3650) });

function ExtendDialog({ open, onClose, id, onSaved }: { open: boolean; onClose: () => void; id: number; onSaved: (data: TenantBilling) => void }) {
  const form = useForm<z.input<typeof extendSchema>, unknown, z.output<typeof extendSchema>>({ resolver: zodResolver(extendSchema), defaultValues: { days: 7 } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.output<typeof extendSchema>) {
    try {
      onSaved(await extendPlan(id, values.days));
      toast.success(t.extended);
      onClose();
    } catch (error) {
      toastError(error, applyServerErrors(error, form.setError, ["days"]));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !isSubmitting ? onClose() : undefined)}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t.extendTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label={t.days} htmlFor="extend-days" error={errors.days?.message} required>
              <Input id="extend-days" type="number" dir="ltr" min={1} max={3650} {...form.register("days")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.extend}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const overrideSchema = z.object({
  entitlement: z.string().min(1, ar.validation.required),
  limit: z.string().regex(/^\d{0,7}$/, ar.validation.number),
  on: z.boolean(),
  reason: z.string().trim().min(3, ar.validation.min(3)).max(300),
  expires_at: z.string(),
});

function OverrideDialog({ open, onClose, id, entitlements, onSaved }: { open: boolean; onClose: () => void; id: number; entitlements: EntitlementInfo[]; onSaved: (data: TenantBilling) => void }) {
  const form = useForm<z.infer<typeof overrideSchema>>({ resolver: zodResolver(overrideSchema), defaultValues: { entitlement: "", limit: "", on: true, reason: "", expires_at: "" } });
  const { errors, isSubmitting } = form.formState;
  const entitlement = useWatch({ control: form.control, name: "entitlement" });
  const chosen = entitlements.find((e) => e.key === entitlement);

  async function onSubmit(values: z.infer<typeof overrideSchema>) {
    const isFeature = chosen?.kind === "feature";
    try {
      onSaved(
        await setOverride(id, values.entitlement, {
          value: isFeature ? values.on : values.limit === "" ? null : Number(values.limit),
          reason: values.reason,
          expires_at: fromCairoInputValue(values.expires_at),
        }),
      );
      toast.success(t.overrideSaved);
      form.reset();
      onClose();
    } catch (error) {
      toastError(error, applyServerErrors(error, form.setError, ["reason", "expires_at"]));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !isSubmitting ? onClose() : undefined)}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t.overrideTitle}</DialogTitle>
            <DialogDescription>{t.overridesHint}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FormField label={t.entitlement} htmlFor="ov-key" error={errors.entitlement?.message} required>
              <Controller
                control={form.control}
                name="entitlement"
                render={({ field }) => <Select id="ov-key" options={entitlements.map((e) => ({ value: e.key, label: e.label }))} value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder="—" />}
              />
            </FormField>
            {chosen?.kind === "feature" ? (
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm font-semibold">{t.value}</span>
                <Controller control={form.control} name="on" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </label>
            ) : (
              <FormField label={t.value} htmlFor="ov-limit" hint={t.valueHint} error={errors.limit?.message}>
                <Input id="ov-limit" inputMode="numeric" dir="ltr" placeholder={b.unlimited} {...form.register("limit")} />
              </FormField>
            )}
            <FormField label={t.reason} htmlFor="ov-reason" error={errors.reason?.message} required>
              <Input id="ov-reason" {...form.register("reason")} />
            </FormField>
            <FormField label={t.expiresAt} htmlFor="ov-expires" error={errors.expires_at?.message} optional>
              <Controller control={form.control} name="expires_at" render={({ field }) => <DateTimeField id="ov-expires" value={field.value} onChange={field.onChange} emptyLabel={ar.common.optional} />} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {ar.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
