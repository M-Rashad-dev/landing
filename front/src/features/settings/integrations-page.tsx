"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, History, KeyRound, MoreHorizontal, Pencil, Plus, Send, Sheet, Trash2, Webhook } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCards, Switch } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Drawer, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { api, apiPage } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { APPS_SCRIPT_CODE, SAMPLE_PAYLOAD, SIGNATURE_SNIPPET } from "@/lib/integrations/apps-script";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.growth.integrations;

type Kind = "google_sheets" | "webhook";
type Hook = { id: number; locked_by_plan: boolean; kind: Kind; name: string; url: string; secret: string; events: string[]; is_active: boolean; failures_count: number; last_status: string | null; last_delivery_at: string | null };
type Delivery = { id: number; event: string; status: string; response_code: number | null; error: string | null; attempt: number; duration_ms: number | null; created_at: string };

const KEY = ["integrations"] as const;

function useIntegrations() {
  return useQuery({ queryKey: KEY, queryFn: async () => (await apiPage<Hook>("/dashboard/integrations")) as unknown as { data: Hook[]; meta: { events: string[] } } });
}

/** «الربط»: Google Sheets and webhooks that receive every order (and its status changes). */
export function IntegrationsPage() {
  const query = useIntegrations();
  const [editing, setEditing] = React.useState<Hook | "new" | null>(null);

  if (query.isPending) return <Skeleton className="h-64 max-w-3xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const { data: hooks, meta } = query.data;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{t.description}</p>
        <Button onClick={() => setEditing("new")}>
          <Plus />
          {t.add}
        </Button>
      </div>
      {hooks.length === 0 ? (
        <EmptyState icon={Sheet} title={t.empty} description={t.emptyText} action={<Button onClick={() => setEditing("new")}><Plus />{t.add}</Button>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {hooks.map((hook) => (
            <li key={hook.id}>
              <HookCard hook={hook} onEdit={() => setEditing(hook)} />
            </li>
          ))}
        </ul>
      )}
      <HookDialog value={editing} events={meta.events} onClose={() => setEditing(null)} />
    </div>
  );
}

function HookCard({ hook, onEdit }: { hook: Hook; onEdit: () => void }) {
  const client = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [log, setLog] = React.useState(false);
  const Icon = hook.kind === "google_sheets" ? Sheet : Webhook;
  const refresh = () => client.invalidateQueries({ queryKey: KEY });

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await action();
      if (done) toast.success(done);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await api<{ delivery: Delivery }>(`/dashboard/integrations/${hook.id}/test`, { method: "POST" });
      if (res.delivery.status === "success") toast.success(t.testOk);
      else toast.error(t.testFailed(res.delivery.response_code ? String(res.delivery.response_code) : (res.delivery.error ?? "—")));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", hook.kind === "google_sheets" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700")} aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {hook.name}
            <Badge size="sm">{t.kinds[hook.kind]}</Badge>
            {hook.failures_count > 0 ? <Badge size="sm" tone="danger">{t.failures(hook.failures_count)}</Badge> : null}
          </p>
          <p dir="ltr" className="truncate text-start text-xs text-ink-3">{hook.url}</p>
          <p className="mt-1 text-xs text-ink-3">{hook.events.map((e) => t.eventNames[e] ?? e).join(" · ")}</p>
          <p className="mt-0.5 text-xs text-ink-3">{hook.last_delivery_at ? t.lastSent(formatDateTime(hook.last_delivery_at)) : t.neverSent}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-2">
          {hook.is_active ? t.active : t.paused}
          <Switch checked={hook.is_active} disabled={busy} onCheckedChange={() => void run(() => api(`/dashboard/integrations/${hook.id}/toggle`, { method: "POST" }), t.toggled(!hook.is_active))} aria-label={`${t.active}: ${hook.name}`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" loading={busy} onClick={() => void test()}>
          <Send />
          {t.test}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setLog(true)}>
          <History />
          {t.deliveries}
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="ms-auto" aria-label={`${ar.common.actions}: ${hook.name}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={onEdit}>
              <Pencil />
              {ar.common.edit}
            </MenuItem>
            {hook.kind === "webhook" ? (
              <MenuItem onSelect={() => void run(() => api(`/dashboard/integrations/${hook.id}/rotate-secret`, { method: "POST" }), t.rotated)}>
                <KeyRound />
                {t.rotate}
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem destructive onSelect={() => setRemoving(true)}>
              <Trash2 />
              {t.remove}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {hook.kind === "webhook" ? <CopyRow label={t.secret} value={hook.secret} /> : null}
      <ConfirmDialog open={removing} onOpenChange={setRemoving} title={t.removeTitle(hook.name)} confirmLabel={t.remove} destructive loading={busy} onConfirm={() => void run(() => api(`/dashboard/integrations/${hook.id}`, { method: "DELETE" }), t.removed)} />
      <Deliveries hook={hook} open={log} onOpenChange={setLog} />
    </article>
  );
}

function Deliveries({ hook, open, onOpenChange }: { hook: Hook; open: boolean; onOpenChange: (o: boolean) => void }) {
  const query = useQuery({ queryKey: [...KEY, "deliveries", hook.id], queryFn: () => api<Delivery[]>(`/dashboard/integrations/${hook.id}/deliveries`), enabled: open });
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={`${t.deliveries} · ${hook.name}`}>
      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-ink-3">{t.noDeliveries}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {query.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Badge size="sm" tone={d.status === "success" ? "success" : d.status === "pending" ? "neutral" : "danger"} dot>
                {d.response_code ?? d.status}
              </Badge>
              <span className="flex-1">{t.eventNames[d.event] ?? d.event}</span>
              <span className="tabular text-xs text-ink-3">{formatDateTime(d.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function CopyRow({ label, value, block = false }: { label: string; value: string; block?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-2">{label}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => undefined);
            setCopied(true);
            toast.success(t.steps.copied);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {block ? t.steps.copy : ar.common.copy}
        </button>
      </div>
      <pre dir="ltr" className={cn("overflow-auto rounded-lg bg-surface-2 p-2.5 text-start text-[11px] leading-relaxed", block ? "max-h-48" : "truncate")}>
        {value}
      </pre>
    </div>
  );
}

const schema = z.object({
  kind: z.enum(["google_sheets", "webhook"]),
  name: z.string().trim().min(1, t.nameRequired).max(80),
  url: z.string().trim().min(1, t.urlRequired).max(500),
  events: z.array(z.string()).min(1, t.eventsRequired),
});
type Values = z.infer<typeof schema>;

function HookDialog({ value, events, onClose }: { value: Hook | "new" | null; events: string[]; onClose: () => void }) {
  return (
    <Dialog open={value !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent size="lg">{value !== null ? <HookForm key={value === "new" ? "new" : value.id} hook={value === "new" ? null : value} events={events} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function HookForm({ hook, events, onClose }: { hook: Hook | null; events: string[]; onClose: () => void }) {
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kind: hook?.kind ?? "google_sheets", name: hook?.name ?? t.kinds.google_sheets, url: hook?.url ?? "", events: hook?.events ?? ["order.created", "order.status_changed"] },
  });
  const { errors, isSubmitting } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });

  const submit = form.handleSubmit(async (v) => {
    try {
      if (hook) await api(`/dashboard/integrations/${hook.id}`, { method: "PUT", body: { name: v.name, url: v.url, events: v.events } });
      else await api("/dashboard/integrations", { method: "POST", body: v });
      toast.success(t.saved);
      await client.invalidateQueries({ queryKey: KEY });
      onClose();
    } catch (error) {
      if (isApiError(error)) for (const field of ["name", "url", "events"] as const) if (error.errors[field]?.[0]) form.setError(field, { message: error.errors[field][0] });
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <DialogHeader title={hook ? hook.name : t.add} />
      <form onSubmit={submit} noValidate>
        <DialogBody className="flex flex-col gap-4">
          {hook ? null : (
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <RadioCards
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("name", t.kinds[v]);
                  }}
                  options={(["google_sheets", "webhook"] as const).map((k) => ({ value: k, title: t.kinds[k], description: t.kindHints[k] }))}
                />
              )}
            />
          )}
          {kind === "google_sheets" ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
              <p className="text-sm font-semibold">{t.steps.title}</p>
              <ol className="flex list-decimal flex-col gap-1 ps-5 text-xs text-ink-2">
                <li>{t.steps.s1}</li>
                <li>{t.steps.s2}</li>
                <li>{t.steps.s3}</li>
                <li>{t.steps.s4}</li>
              </ol>
              <CopyRow label="Apps Script" value={APPS_SCRIPT_CODE} block />
            </div>
          ) : null}
          <Field label={t.name} htmlFor="hook-name" error={errors.name?.message} required>
            <Input id="hook-name" {...form.register("name")} />
          </Field>
          <Field label={kind === "google_sheets" ? t.urlSheets : t.url} htmlFor="hook-url" error={errors.url?.message} required>
            <Input id="hook-url" dir="ltr" placeholder="https://" {...form.register("url")} />
          </Field>
          <Field label={t.events} error={errors.events?.message}>
            <Controller
              control={form.control}
              name="events"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {events.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value.includes(e)} onCheckedChange={(on) => field.onChange(on === true ? [...field.value, e] : field.value.filter((x) => x !== e))} />
                      {t.eventNames[e] ?? e}
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>
          {kind === "webhook" ? (
            <>
              <CopyRow label={t.sample} value={SAMPLE_PAYLOAD} block />
              <CopyRow label={t.signature} value={SIGNATURE_SNIPPET} block />
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
