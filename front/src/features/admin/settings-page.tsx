"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, Send } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/forms/inputs";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { formatPhone } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { ar } from "@/messages/ar";
import { saveAlertSettings, sendTestAlert, useAlertSettings, type AlertEvent, type AlertSettings } from "./api";

const t = ar.admin.settings;
const a = t.alerts;

const schema = z.object({
  channel: z.enum(["whatsapp", "email"]),
  phone: z.string().refine((v) => v.trim() === "" || normalizePhone(v) !== null, a.phoneInvalid),
  email: z.union([z.literal(""), z.email(a.emailInvalid).max(120)]),
  events: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function AdminSettingsPage() {
  const query = useAlertSettings();
  return (
    <>
      <PageHeader title={t.title} />
      {query.isPending ? (
        <Skeleton className="h-96 max-w-3xl rounded-xl" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <AlertsForm settings={query.data} onSaved={() => void query.refetch()} />
      )}
    </>
  );
}

function AlertsForm({ settings, onSaved }: { settings: AlertSettings; onSaved: () => void }) {
  const [testing, setTesting] = React.useState(false);
  const toValues = (v: AlertSettings): Values => ({ channel: v.channel, phone: v.phone ? formatPhone(v.phone) : "", email: v.email ?? "", events: v.events });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(settings) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const channel = useWatch({ control: form.control, name: "channel" });

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await saveAlertSettings({ channel: v.channel, phone: v.phone.trim() || null, email: v.email.trim() || null, events: v.events as AlertEvent[] });
      form.reset(toValues(saved));
      toast.success(a.saved);
      onSaved();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["channel", "phone", "email"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) toast.error(unmatched[0] ?? errorMessage(error));
    }
  });

  async function test() {
    setTesting(true);
    try {
      const result = await sendTestAlert();
      toast.success(a.testSent(result.sent_to));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-4">
      {channel === "whatsapp" && !settings.whatsapp_ready ? (
        <Alert tone="warning" title={a.whatsappNotReadyTitle}>
          {a.whatsappNotReadyText}
        </Alert>
      ) : null}
      {settings.mail_ready ? null : (
        <Alert tone="warning" title={a.notReadyTitle}>
          {a.notReadyText}
        </Alert>
      )}
      <Panel>
        <PanelHeader title={a.title} description={a.description} />
        <PanelBody className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold">{a.channel}</p>
            <Controller
              control={form.control}
              name="channel"
              render={({ field }) => (
                <RadioCards
                  name="alert-channel"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={[
                    { value: "whatsapp", title: a.whatsapp, description: a.whatsappHint },
                    { value: "email", title: a.emailChoice, description: a.emailChoiceHint },
                  ]}
                />
              )}
            />
            <p className="text-xs text-ink-3">{a.fallback}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={a.phone} htmlFor="alert-phone" hint={a.phoneHint(settings.own_phone ? formatPhone(settings.own_phone) : null)} error={errors.phone?.message}>
              <PhoneInput id="alert-phone" aria-invalid={Boolean(errors.phone)} {...form.register("phone")} />
            </Field>
            <Field label={a.email} htmlFor="alert-email" hint={a.emailHint(settings.own_email)} error={errors.email?.message}>
              <Input id="alert-email" type="email" dir="ltr" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
            </Field>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold">{a.which}</p>
            <Controller
              control={form.control}
              name="events"
              render={({ field }) => (
                <div className="flex flex-col divide-y divide-border">
                  {settings.available.map((key) => (
                    <SwitchRow
                      key={key}
                      title={a.events[key]?.title ?? key}
                      description={a.events[key]?.description}
                      checked={field.value.includes(key)}
                      onCheckedChange={(on) => field.onChange(on ? [...field.value, key] : field.value.filter((k) => k !== key))}
                    />
                  ))}
                </div>
              )}
            />
          </div>
        </PanelBody>
        <PanelFooter className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => void test()} loading={testing} disabled={isDirty}>
            {settings.mail_ready ? <Send /> : <MailCheck />}
            {a.test}
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      </Panel>
    </form>
  );
}
