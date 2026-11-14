"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, Send } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { saveAlertSettings, sendTestAlert, useAlertSettings, type AlertEvent, type AlertSettings } from "./api";

const t = ar.admin.settings;
const a = t.alerts;

const schema = z.object({
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
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: settings.email ?? "", events: settings.events } });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await saveAlertSettings({ email: v.email.trim() || null, events: v.events as AlertEvent[] });
      form.reset({ email: saved.email ?? "", events: saved.events });
      toast.success(a.saved);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
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
      {settings.mail_ready ? null : (
        <Alert tone="warning" title={a.notReadyTitle}>
          {a.notReadyText}
        </Alert>
      )}
      <Panel>
        <PanelHeader title={a.title} description={a.description} />
        <PanelBody className="flex flex-col gap-5">
          <Field label={a.email} htmlFor="alert-email" hint={a.emailHint} error={errors.email?.message}>
            <Input id="alert-email" type="email" dir="ltr" autoComplete="email" aria-invalid={Boolean(errors.email)} className="sm:max-w-sm" {...form.register("email")} />
          </Field>
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
          <Button type="button" variant="outline" onClick={() => void test()} loading={testing} disabled={!settings.email || isDirty} title={!settings.email ? a.testNeedsEmail : undefined}>
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
