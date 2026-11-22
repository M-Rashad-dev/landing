"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, ExternalLink, Send, Server, Trash2 } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SaveBar } from "@/components/forms/form-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";

const t = ar.mail;
const v = ar.validation;
const KEY = ["mail-settings"] as const;

export type MailSettings = {
  mode: "platform" | "smtp";
  sender_name: string | null;
  reply_to: string | null;
  default_sender_name: string;
  default_reply_to: string | null;
  platform_address: string;
  smtp: { host: string | null; port: number | null; encryption: "ssl" | "tls" | null; username: string | null; from_address: string | null; has_password: boolean };
  status: "active" | "failed" | null;
  last_error: string | null;
  checked_at: string | null;
};

const PORTS = ["465", "587", "25", "2525"] as const;
/** Ready settings for the usual providers (the merchant only types his email and app password). */
const PRESETS = {
  gmail: { host: "smtp.gmail.com", port: "465", encryption: "ssl" },
  outlook: { host: "smtp-mail.outlook.com", port: "587", encryption: "tls" },
  zoho: { host: "smtp.zoho.com", port: "465", encryption: "ssl" },
  hostinger: { host: "smtp.hostinger.com", port: "465", encryption: "ssl" },
} as const;
type Provider = keyof typeof PRESETS | "other";

const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const optionalEmail = z.string().trim().max(191, v.max(191)).refine((s) => s === "" || z.email().safeParse(s).success, v.email);

const schema = (hasPassword: boolean) =>
  z
    .object({
      mode: z.enum(["platform", "smtp"]),
      sender_name: z.string().trim().max(60, v.max(60)),
      reply_to: optionalEmail,
      host: z.string().trim(),
      port: z.enum(PORTS),
      encryption: z.enum(["ssl", "tls"]),
      username: z.string().trim().max(191, v.max(191)),
      password: z.string().max(200, v.max(200)),
      from_address: optionalEmail,
    })
    .superRefine((d, ctx) => {
      if (d.mode !== "smtp") return;
      if (!HOST.test(d.host)) ctx.addIssue({ code: "custom", path: ["host"], message: d.host === "" ? v.required : t.hostFormat });
      if (d.username === "") ctx.addIssue({ code: "custom", path: ["username"], message: v.required });
      if (!hasPassword && d.password.trim() === "") ctx.addIssue({ code: "custom", path: ["password"], message: t.passwordRequired });
    });
type Values = z.infer<ReturnType<typeof schema>>;

const toValues = (s: MailSettings): Values => ({
  mode: s.mode,
  sender_name: s.sender_name ?? "",
  reply_to: s.reply_to ?? "",
  // A new mailbox starts on Gmail's settings (the most common).
  host: s.smtp.host ?? PRESETS.gmail.host,
  port: (PORTS as readonly string[]).includes(String(s.smtp.port)) ? (String(s.smtp.port) as Values["port"]) : PRESETS.gmail.port,
  encryption: s.smtp.encryption ?? PRESETS.gmail.encryption,
  username: s.smtp.username ?? "",
  password: "",
  from_address: s.smtp.from_address ?? "",
});

const providerOf = (host: string): Provider => (Object.entries(PRESETS).find(([, p]) => p.host === host.trim().toLowerCase())?.[0] as Provider | undefined) ?? "other";

/** «الإيميلات»: from the platform in the store's name (default), or from the merchant's own mailbox. */
export function MailPage() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<MailSettings>("/dashboard/mail-settings") });
  if (query.isPending) return <Skeleton className="h-96 max-w-3xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  return <MailForm initial={query.data} />;
}

function MailForm({ initial }: { initial: MailSettings }) {
  const client = useQueryClient();
  const [settings, setSettings] = React.useState(initial);
  const form = useForm<Values>({ resolver: zodResolver(schema(settings.smtp.has_password)), defaultValues: toValues(initial) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const mode = useWatch({ control: form.control, name: "mode" });
  const [host, port, encryption] = useWatch({ control: form.control, name: ["host", "port", "encryption"] });
  const [provider, setProvider] = React.useState<Provider>(() => providerOf(initial.smtp.host ?? PRESETS.gmail.host));
  const [forgetting, setForgetting] = React.useState(false);
  const [busy, setBusy] = React.useState<"forget" | "test" | null>(null);
  const [testTo, setTestTo] = React.useState("");

  const keep = (saved: MailSettings) => {
    setSettings(saved);
    client.setQueryData(KEY, saved);
    form.reset(toValues(saved));
  };

  const pick = (p: Provider) => {
    setProvider(p);
    if (p === "other") return;
    form.setValue("host", PRESETS[p].host, { shouldDirty: true });
    form.setValue("port", PRESETS[p].port, { shouldDirty: true });
    form.setValue("encryption", PRESETS[p].encryption, { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (d) => {
    const smtp = d.mode === "smtp";
    try {
      const saved = await api<MailSettings>("/dashboard/mail-settings", {
        method: "PUT",
        body: {
          mode: d.mode,
          sender_name: d.sender_name || null,
          reply_to: d.reply_to || null,
          smtp_host: smtp ? d.host : null,
          smtp_port: smtp ? Number(d.port) : null,
          smtp_encryption: smtp ? d.encryption : null,
          smtp_username: smtp ? d.username : null,
          smtp_password: smtp && d.password.trim() !== "" ? d.password : null,
          from_address: smtp ? d.from_address || null : null,
        },
      });
      keep(saved);
      toast.success(t.saved);
    } catch (error) {
      if (isApiError(error)) {
        const map: Record<string, keyof Values> = { smtp_host: "host", smtp_port: "port", smtp_encryption: "encryption", smtp_username: "username", smtp_password: "password" };
        for (const [key, messages] of Object.entries(error.errors)) form.setError(map[key] ?? (key as keyof Values), { message: messages[0] });
      }
      toast.error(errorMessage(error));
    }
  });

  const forget = async () => {
    setBusy("forget");
    try {
      keep(await api<MailSettings>("/dashboard/mail-settings/mailbox", { method: "DELETE" }));
      setForgetting(false);
      toast.success(t.forgotten);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const sent = await api<{ via: string; to: string; settings: MailSettings }>("/dashboard/mail-settings/test", { method: "POST", body: { to: testTo.trim() || null } });
      setSettings(sent.settings);
      client.setQueryData(KEY, sent.settings);
      toast.success(t.testSent(sent.to));
    } catch (error) {
      void client.invalidateQueries({ queryKey: KEY });
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const savedSmtp = settings.mode === "smtp" && settings.smtp.has_password;
  const help = provider === "gmail" ? t.gmailHelp : provider === "outlook" ? t.outlookHelp : null;

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-ink-2">{t.description}</p>

      <Panel>
        <PanelHeader title={t.mode} />
        <PanelBody>
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <RadioCards
                name="mode"
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  { value: "platform", title: t.modes.platform.title, description: t.modes.platform.description(settings.platform_address) },
                  { value: "smtp", title: t.modes.smtp.title, description: t.modes.smtp.description },
                ]}
              />
            )}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title={<span className="flex items-center gap-2"><AtSign className="size-4 text-ink-3" aria-hidden />{t.identity}</span>} description={t.identityHint} />
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t.senderName} htmlFor="mail-sender" hint={t.senderNameHint(settings.default_sender_name)} error={errors.sender_name?.message} optional>
            <Input id="mail-sender" placeholder={settings.default_sender_name} {...form.register("sender_name")} />
          </Field>
          <Field label={t.replyTo} htmlFor="mail-reply" hint={t.replyToHint(settings.default_reply_to)} error={errors.reply_to?.message} optional>
            <Input id="mail-reply" type="email" dir="ltr" placeholder={settings.default_reply_to ?? "you@example.com"} {...form.register("reply_to")} />
          </Field>
        </PanelBody>
      </Panel>

      {mode === "smtp" ? (
        <Panel>
          <PanelHeader
            title={<span className="flex items-center gap-2"><Server className="size-4 text-ink-3" aria-hidden />{t.mailbox}</span>}
            description={t.mailboxHint}
            actions={settings.status && settings.mode === "smtp" ? <Badge tone={settings.status === "active" ? "success" : "danger"} dot>{t.status[settings.status]}</Badge> : undefined}
          />
          <PanelBody className="flex flex-col gap-4">
            {settings.status === "failed" && settings.last_error ? <Alert tone="danger" title={t.failedTitle}>{t.failedText(settings.last_error)}</Alert> : null}
            <Field label={t.provider}>
              <Segmented value={provider} onChange={pick} options={(Object.keys(t.providers) as Provider[]).map((p) => ({ value: p, label: t.providers[p] }))} />
            </Field>
            {help ? (
              <Alert tone="info" action={provider === "gmail" ? <Button asChild variant="outline" size="sm"><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">{t.gmailLink}<ExternalLink className="size-3.5" aria-hidden /></a></Button> : undefined}>
                {help}
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.username} htmlFor="mail-user" error={errors.username?.message} required>
                <Input id="mail-user" type="email" dir="ltr" autoComplete="off" placeholder="store@gmail.com" {...form.register("username")} />
              </Field>
              <Field label={t.password} htmlFor="mail-pass" hint={settings.smtp.has_password ? t.passwordSaved : undefined} error={errors.password?.message} required={!settings.smtp.has_password}>
                <Input id="mail-pass" type="password" dir="ltr" autoComplete="new-password" placeholder={settings.smtp.has_password ? "••••••••" : "abcd efgh ijkl mnop"} {...form.register("password")} />
              </Field>
            </div>
            {provider === "other" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t.host} htmlFor="mail-host" error={errors.host?.message} required className="sm:col-span-3">
                  <Input id="mail-host" dir="ltr" placeholder="smtp.example.com" {...form.register("host")} />
                </Field>
                <Field label={t.port} htmlFor="mail-port">
                  <Controller control={form.control} name="port" render={({ field }) => <Select id="mail-port" value={field.value} onValueChange={field.onChange} options={PORTS.map((p) => ({ value: p, label: p }))} />} />
                </Field>
                <Field label={t.encryption} className="sm:col-span-2">
                  <Controller control={form.control} name="encryption" render={({ field }) => <Segmented value={field.value} onChange={field.onChange} options={(["ssl", "tls"] as const).map((e) => ({ value: e, label: t.encryptions[e] }))} />} />
                </Field>
              </div>
            ) : (
              <p className="text-xs text-ink-3" dir="ltr">{`${host} · ${port} · ${t.encryptions[encryption]}`}</p>
            )}
            <Field label={t.fromAddress} htmlFor="mail-from" hint={t.fromAddressHint} error={errors.from_address?.message} optional>
              <Input id="mail-from" type="email" dir="ltr" placeholder={form.getValues("username") || "store@gmail.com"} {...form.register("from_address")} />
            </Field>
            {savedSmtp ? (
              <div>
                <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => setForgetting(true)}>
                  <Trash2 className="size-4" aria-hidden />
                  {t.forget}
                </Button>
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title={<span className="flex items-center gap-2"><Send className="size-4 text-ink-3" aria-hidden />{t.test}</span>} description={t.testHint} />
        <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t.testTo} htmlFor="mail-test" className="flex-1" hint={isDirty ? t.testSaveFirst : undefined}>
            <Input id="mail-test" type="email" dir="ltr" placeholder={t.testToPlaceholder} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </Field>
          <Button type="button" variant="outline" loading={busy === "test"} disabled={isDirty} onClick={() => void test()}>
            {t.testSend}
          </Button>
        </PanelBody>
      </Panel>

      <SaveBar visible={isDirty} saving={isSubmitting} onSave={() => void submit()} onDiscard={() => form.reset()} />
      <ConfirmDialog open={forgetting} onOpenChange={setForgetting} title={t.forgetTitle} description={t.forgetText} confirmLabel={t.forget} destructive loading={busy === "forget"} onConfirm={() => void forget()} />
    </form>
  );
}
