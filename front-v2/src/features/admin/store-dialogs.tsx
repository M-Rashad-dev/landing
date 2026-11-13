"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CopyField } from "@/components/data/details";
import { DatePicker } from "@/components/forms/date-pickers";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Checkbox, RadioCards } from "@/components/ui/choice";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { extendPlan, grantPlan, grantTheme, setOverride, suspendStore, useAdminPlans, useAdminThemes, type StoreTheme } from "./api";

const t = ar.admin.store;
const billingT = ar.settings.billing;

type DialogProps = { storeId: number; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void | Promise<unknown> };

async function run(action: () => Promise<unknown>, done: string, after: () => void | Promise<unknown>) {
  try {
    await action();
    toast.success(done);
    await after();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

/* ---------- suspend ---------- */

const reasonSchema = z.object({ reason: z.string().trim().min(3, t.suspend.reasonRequired).max(500) });

export function SuspendDialog({ storeId, open, onOpenChange, onDone }: DialogProps) {
  const form = useForm<z.infer<typeof reasonSchema>>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit((v) =>
    run(() => suspendStore(storeId, v.reason.trim()), t.suspend.done, async () => {
      onOpenChange(false);
      form.reset();
      await onDone();
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t.suspend.title} description={t.suspend.text} />
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <Field label={t.suspend.reason} htmlFor="suspend-reason" hint={t.suspend.reasonHint} error={errors.reason?.message} required>
              <Textarea id="suspend-reason" rows={3} aria-invalid={Boolean(errors.reason)} {...form.register("reason")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={isSubmitting}>
              {t.suspend.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- temporary password (shown once) ---------- */

export function PasswordResultDialog({ password, onClose }: { password: string | null; onClose: () => void }) {
  return (
    <Dialog open={password !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="sm">
        <DialogHeader title={t.password.resultTitle} description={t.password.resultText} />
        <DialogBody>{password ? <CopyField label={t.password.label} value={password} /> : null}</DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{t.password.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- grant a plan / extend ---------- */

const days = z.number({ error: t.daysInvalid }).int(t.daysInvalid).min(1, t.daysInvalid).max(3650, t.daysInvalid);
const grantSchema = z.object({ plan_key: z.string().min(1, t.grant.planRequired), days, note: z.string().max(500) });

export function GrantPlanDialog({ storeId, open, onOpenChange, onDone, currentPlan }: DialogProps & { currentPlan: string | null }) {
  const plans = useAdminPlans();
  const form = useForm<z.infer<typeof grantSchema>>({ resolver: zodResolver(grantSchema), defaultValues: { plan_key: currentPlan ?? "", days: 30, note: "" } });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit((v) =>
    run(() => grantPlan(storeId, { plan_key: v.plan_key, days: v.days, note: v.note.trim() || null }), t.grant.done, async () => {
      onOpenChange(false);
      await onDone();
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t.grant.title} description={t.grant.text} />
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            <Field label={t.grant.plan} error={errors.plan_key?.message} required>
              <Controller
                control={form.control}
                name="plan_key"
                render={({ field }) => (
                  <Select
                    aria-label={t.grant.plan}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={(plans.data ?? []).filter((p) => !p.is_archived).map((p) => ({ value: p.key, label: p.name }))}
                    searchable={false}
                  />
                )}
              />
            </Field>
            <Field label={t.grant.days} htmlFor="grant-days" error={errors.days?.message} required>
              <Input id="grant-days" type="number" inputMode="numeric" min={1} max={3650} dir="ltr" className="tabular" {...form.register("days", { valueAsNumber: true })} />
            </Field>
            <Field label={t.grant.note} htmlFor="grant-note" hint={t.grant.noteHint} optional>
              <Textarea id="grant-note" rows={2} {...form.register("note")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.grant.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const extendSchema = z.object({ days });

export function ExtendDialog({ storeId, open, onOpenChange, onDone }: DialogProps) {
  const form = useForm<z.infer<typeof extendSchema>>({ resolver: zodResolver(extendSchema), defaultValues: { days: 7 } });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit((v) =>
    run(() => extendPlan(storeId, v.days), t.extend.done, async () => {
      onOpenChange(false);
      await onDone();
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t.extend.title} description={t.extend.text} />
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <Field label={t.extend.days} htmlFor="extend-days" error={errors.days?.message} required>
              <Input id="extend-days" type="number" inputMode="numeric" min={1} max={3650} dir="ltr" className="tabular" {...form.register("days", { valueAsNumber: true })} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.extend.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- a limit / feature just for this store ---------- */

export const LIMIT_KEYS = Object.keys(billingT.limits) as Array<keyof typeof billingT.limits>;
export const FEATURE_KEYS = Object.keys(billingT.features) as Array<keyof typeof billingT.features>;
/** Our label for a plan limit / feature; the server label for the ones the dashboard does not name. */
export const entitlementLabel = (key: string, fallback?: string) => (billingT.limits as Record<string, string>)[key] ?? (billingT.features as Record<string, string>)[key] ?? fallback ?? key;
const isFeature = (key: string) => (FEATURE_KEYS as string[]).includes(key);

const overrideSchema = z
  .object({
    entitlement: z.string().min(1),
    unlimited: z.boolean(),
    limit: z.number().int().min(0).max(1_000_000).nullable(),
    enabled: z.enum(["on", "off"]),
    reason: z.string().trim().min(3, t.overrides.reasonRequired).max(300),
    expires_at: z.string(),
  })
  .refine((v) => isFeature(v.entitlement) || v.unlimited || (v.limit !== null && !Number.isNaN(v.limit)), { path: ["limit"], message: ar.validation.required });

export function OverrideDialog({ storeId, open, onOpenChange, onDone }: DialogProps) {
  const form = useForm<z.infer<typeof overrideSchema>>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { entitlement: LIMIT_KEYS[0], unlimited: false, limit: null, enabled: "on", reason: "", expires_at: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const entitlement = useWatch({ control: form.control, name: "entitlement" });
  const unlimited = useWatch({ control: form.control, name: "unlimited" });
  const feature = isFeature(entitlement);

  const submit = form.handleSubmit((v) =>
    run(
      () => setOverride(storeId, v.entitlement, { value: feature ? v.enabled === "on" : v.unlimited ? null : v.limit, reason: v.reason.trim(), expires_at: v.expires_at || null }),
      t.overrides.done,
      async () => {
        onOpenChange(false);
        form.reset();
        await onDone();
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader title={t.overrides.dialogTitle} description={t.overrides.hint} />
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            <Field label={t.overrides.what} required>
              <Controller
                control={form.control}
                name="entitlement"
                render={({ field }) => (
                  <Select
                    aria-label={t.overrides.what}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[...LIMIT_KEYS, ...FEATURE_KEYS].map((k) => ({ value: k, label: entitlementLabel(k) }))}
                  />
                )}
              />
            </Field>
            {feature ? (
              <Field label={t.overrides.featureValue}>
                <Controller
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <RadioCards
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      options={[
                        { value: "on", title: t.overrides.on },
                        { value: "off", title: t.overrides.off },
                      ]}
                    />
                  )}
                />
              </Field>
            ) : (
              <div className="flex flex-col gap-2">
                <Field label={t.overrides.limitValue} htmlFor="override-limit" error={errors.limit?.message}>
                  <Input
                    id="override-limit"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    dir="ltr"
                    className="tabular"
                    disabled={unlimited}
                    {...form.register("limit", { setValueAs: (v: string) => (v === "" || v === null ? null : Number(v)) })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <Controller control={form.control} name="unlimited" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />} />
                  {t.overrides.unlimited}
                </label>
              </div>
            )}
            <Field label={t.overrides.reason} htmlFor="override-reason" error={errors.reason?.message} required>
              <Textarea id="override-reason" rows={2} {...form.register("reason")} />
            </Field>
            <Field label={t.overrides.expiresAt} hint={t.overrides.expiresHint} optional>
              <Controller control={form.control} name="expires_at" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} withTime />} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.overrides.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- give a theme ---------- */

const themeSchema = z.object({ theme_key: z.string().min(1, t.themes.themeRequired), note: z.string().max(300) });

export function GrantThemeDialog({ storeId, open, onOpenChange, onDone, owned }: DialogProps & { owned: StoreTheme[] }) {
  const themes = useAdminThemes();
  const form = useForm<z.infer<typeof themeSchema>>({ resolver: zodResolver(themeSchema), defaultValues: { theme_key: "", note: "" } });
  const { errors, isSubmitting } = form.formState;
  const ownedKeys = new Set(owned.map((o) => o.theme_key));
  const options = (themes.data ?? []).filter((th) => !th.is_free && !ownedKeys.has(th.key)).map((th) => ({ value: th.key, label: th.name }));

  const submit = form.handleSubmit((v) =>
    run(() => grantTheme(storeId, v.theme_key, v.note.trim() || null), t.themes.done, async () => {
      onOpenChange(false);
      form.reset();
      await onDone();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t.themes.dialogTitle} />
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            {themes.data && options.length === 0 ? (
              <Alert tone="info">{t.themes.allOwned}</Alert>
            ) : (
              <Field label={t.themes.theme} error={errors.theme_key?.message} required>
                <Controller control={form.control} name="theme_key" render={({ field }) => <Select aria-label={t.themes.theme} value={field.value} onValueChange={field.onChange} options={options} searchable={false} />} />
              </Field>
            )}
            <Field label={t.themes.note} htmlFor="theme-note" optional>
              <Textarea id="theme-note" rows={2} {...form.register("note")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={options.length === 0}>
              {t.themes.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useDialog() {
  const [open, setOpen] = React.useState(false);
  return { open, onOpenChange: setOpen, show: () => setOpen(true) };
}
