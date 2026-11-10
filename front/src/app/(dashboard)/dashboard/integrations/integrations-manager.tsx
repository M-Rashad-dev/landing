"use client";

import { PlanLockedBadge } from "@/components/billing/plan";

import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, ExternalLink, Eye, EyeOff, Pause, Pencil, Play, Plus, RefreshCw, Send, Sheet, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { APPS_SCRIPT_CODE, SAMPLE_PAYLOAD, SIGNATURE_SNIPPET } from "@/lib/integrations/apps-script";
import {
  deleteIntegration,
  integrationKeys,
  rotateSecret,
  saveIntegration,
  SHEETS_EVENTS,
  testIntegration,
  toggleIntegration,
  useDeliveries,
  useIntegrations,
  type Integration,
  type IntegrationEvent,
} from "@/lib/integrations/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.integrations;

function copy(text: string, message: string = ar.common.copied) {
  void navigator.clipboard?.writeText(text);
  toast.success(message);
}

export function IntegrationsManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useIntegrations();
  const [editing, setEditing] = useState<Integration | "new" | null>(null);
  const [removing, setRemoving] = useState<Integration | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: integrationKeys.all });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const list = data.data;
  const events = (data.meta.events as IntegrationEvent[] | undefined) ?? [];
  const sheets = list.filter((i) => i.kind === "google_sheets");
  const hooks = list.filter((i) => i.kind === "webhook");

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteIntegration(removing.id);
      toast.success(t.removed);
      setRemoving(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <SectionTitle icon={Sheet} title={t.sheets.title} text={t.sheets.text} tone="success" />
        {sheets.map((item) => (
          <IntegrationCard key={item.id} item={item} onChanged={refresh} onRemove={() => setRemoving(item)} />
        ))}
        {sheets.length === 0 ? <SheetsSetup onConnected={refresh} /> : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle icon={Webhook} title={t.webhooks.title} text={t.webhooks.text} tone="primary" />
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t.webhooks.add}
          </Button>
        </div>
        {hooks.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t.webhooks.empty}</p> : null}
        {hooks.map((item) => (
          <IntegrationCard key={item.id} item={item} onChanged={refresh} onEdit={() => setEditing(item)} onRemove={() => setRemoving(item)} />
        ))}
        <Docs />
      </section>

      <WebhookDialog key={editing === "new" ? "new" : (editing?.id ?? "none")} editing={editing} events={events} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)} title={removing ? t.removeConfirm(removing.name) : ""} confirmLabel={t.remove} loading={busy} onConfirm={remove} />
    </div>
  );
}

function SectionTitle({ icon: Icon, title, text, tone }: { icon: typeof Sheet; title: string; text: string; tone: "success" | "primary" }) {
  return (
    <div className="flex max-w-2xl items-start gap-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone === "success" ? "bg-success/10 text-success" : "bg-secondary text-primary")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function SheetsSetup({ onConnected }: { onConnected: () => Promise<unknown> }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [showCode, setShowCode] = useState(false);

  async function connect() {
    setSaving(true);
    setError(undefined);
    try {
      const created = await saveIntegration({ kind: "google_sheets", name: t.sheets.name, url: url.trim(), events: SHEETS_EVENTS });
      const result = await testIntegration(created.id);
      if (result.delivery.status === "success") toast.success(t.testOk);
      else toast.error(t.testFailed(result.delivery.error ?? ""));
      await onConnected();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setError(err.errors.url?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: t.sheets.step1,
      text: t.sheets.step1Text,
      action: (
        <Button variant="outline" size="sm" asChild>
          <a href="https://sheets.new" target="_blank" rel="noreferrer">
            <ExternalLink />
            {t.sheets.openSheet}
          </a>
        </Button>
      ),
    },
    {
      title: t.sheets.step2,
      text: t.sheets.step2Text,
      action: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => copy(APPS_SCRIPT_CODE)}>
            <Copy />
            {t.sheets.copyCode}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCode((v) => !v)} aria-expanded={showCode}>
            <ChevronDown className={cn("transition-transform", showCode && "rotate-180")} />
            {t.sheets.showCode}
          </Button>
        </div>
      ),
    },
    { title: t.sheets.step3, text: t.sheets.step3Text, action: null },
  ];

  return (
    <Card className="flex flex-col gap-5 p-5">
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4">
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
              {step.title}
            </span>
            <p className="text-sm text-muted-foreground">{step.text}</p>
            {step.action ? <div className="mt-auto pt-1">{step.action}</div> : null}
          </li>
        ))}
      </ol>
      {showCode ? (
        <pre dir="ltr" className="max-h-72 overflow-auto rounded-xl bg-[#12152a] p-4 text-start text-xs leading-relaxed text-[#e6e8f5]">
          <code>{APPS_SCRIPT_CODE}</code>
        </pre>
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">4</span>
          {t.sheets.step4}
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <FormField label={t.sheets.urlLabel} htmlFor="sheets-url" error={error}>
              <Input id="sheets-url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
            </FormField>
          </div>
          <Button className="sm:mt-6" onClick={connect} loading={saving} disabled={!url.trim()}>
            <Check />
            {t.sheets.connect}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function IntegrationCard({ item, onChanged, onEdit, onRemove }: { item: Integration; onChanged: () => Promise<unknown>; onEdit?: () => void; onRemove: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const deliveries = useDeliveries(item.id, showLog);
  const queryClient = useQueryClient();

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
      await onChanged();
      if (showLog) await queryClient.invalidateQueries({ queryKey: integrationKeys.deliveries(item.id) });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const sheets = item.kind === "google_sheets";
  const when = item.last_delivery_at ? formatCairo(item.last_delivery_at) : null;

  return (
    <Card className={cn("flex min-w-0 flex-col gap-4 p-5", !item.is_active && "opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold">
            {sheets ? <Sheet className="size-4 text-success" aria-hidden /> : <Webhook className="size-4 text-primary" aria-hidden />}
            {sheets && item.is_active ? t.sheets.connected : item.name}
          </p>
          <p dir="ltr" className="mt-1 truncate text-start text-xs text-muted-foreground">
            {item.url}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <PlanLockedBadge locked={item.locked_by_plan} />
          <Badge variant={item.is_active ? "success" : "secondary"}>{item.is_active ? t.active : t.paused}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.events.map((event) => (
          <span key={event} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            {t.eventLabels[event] ?? event}
          </span>
        ))}
      </div>

      {when ? <p className={cn("text-xs", item.last_status === "failed" ? "text-destructive" : "text-muted-foreground")}>{item.last_status === "failed" ? t.lastFailed(when) : t.lastOk(when)}</p> : null}
      {item.failures_count > 0 ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{t.failures(item.failures_count)}</p> : null}

      {!sheets ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.webhooks.secret}</span>
          <div className="flex items-center gap-1 rounded-lg bg-muted/60 px-3 py-1.5">
            <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs">
              {showSecret ? item.secret : "•".repeat(32)}
            </code>
            <Button size="icon-sm" variant="ghost" aria-label={showSecret ? t.webhooks.hide : t.webhooks.reveal} onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? <EyeOff /> : <Eye />}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={ar.common.copy} onClick={() => copy(item.secret)}>
              <Copy />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t.webhooks.rotate}
              title={t.webhooks.rotate}
              disabled={busy !== null}
              onClick={() =>
                run("rotate", async () => {
                  await rotateSecret(item.id);
                  toast.success(t.webhooks.rotated);
                })
              }
            >
              <RefreshCw />
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">{t.webhooks.secretHint}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          loading={busy === "test"}
          disabled={busy !== null || !item.is_active}
          onClick={() =>
            run("test", async () => {
              const result = await testIntegration(item.id);
              if (result.delivery.status === "success") toast.success(t.testOk);
              else toast.error(t.testFailed(result.delivery.error ?? ""));
            })
          }
        >
          <Send />
          {t.test}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("toggle", async () => void (await toggleIntegration(item.id)))}>
          {item.is_active ? <Pause /> : <Play />}
          {item.is_active ? t.pause : t.resume}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}>
          <ChevronDown className={cn("transition-transform", showLog && "rotate-180")} />
          {t.log}
        </Button>
        <span className="flex-1" />
        {onEdit ? (
          <Button size="icon-sm" variant="ghost" aria-label={t.webhooks.edit} onClick={onEdit}>
            <Pencil />
          </Button>
        ) : null}
        <Button size="icon-sm" variant="ghost" aria-label={t.remove} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>

      {showLog ? (
        <div className="rounded-xl border">
          {deliveries.isPending ? (
            <Skeleton className="h-24" />
          ) : (deliveries.data ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t.logEmpty}</p>
          ) : (
            <ul className="divide-y text-sm">
              {(deliveries.data ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className={cn("size-2 rounded-full", d.status === "success" ? "bg-success" : "bg-destructive")} aria-hidden />
                  <span className="font-medium">{t.eventLabels[d.event] ?? d.event}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{d.response_code ?? "—"}</span>
                  {d.attempt > 1 ? <span className="text-xs text-muted-foreground">{t.attempt(d.attempt)}</span> : null}
                  {d.error ? <span className="basis-full text-xs text-destructive">{d.error}</span> : null}
                  <span className="ms-auto text-xs text-muted-foreground">{formatCairo(d.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function WebhookDialog({ editing, events, onClose, onSaved }: { editing: Integration | "new" | null; events: IntegrationEvent[]; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const current = editing && editing !== "new" ? editing : null;
  const [name, setName] = useState(current?.name ?? "");
  const [url, setUrl] = useState(current?.url ?? "");
  const [chosen, setChosen] = useState<IntegrationEvent[]>(current?.events ?? ["order.created"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      await saveIntegration({ ...(current ? {} : { kind: "webhook" as const }), name: name.trim(), url: url.trim(), events: chosen }, current?.id);
      toast.success(t.saved);
      await onSaved();
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k.startsWith("events") ? "events" : k, v[0] ?? ""])));
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? t.webhooks.edit : t.webhooks.add}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label={t.webhooks.name} htmlFor="wh-name" error={errors.name} required>
            <Input id="wh-name" value={name} maxLength={80} placeholder={t.webhooks.namePlaceholder} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={t.webhooks.url} htmlFor="wh-url" error={errors.url} required>
            <Input id="wh-url" dir="ltr" value={url} maxLength={500} placeholder="https://example.com/webhooks/orders" onChange={(e) => setUrl(e.target.value)} />
          </FormField>
          <FormField label={t.webhooks.events} error={errors.events}>
            <div className="flex flex-col gap-2">
              {events.map((event) => (
                <label key={event} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  {t.eventLabels[event] ?? event}
                  <Switch checked={chosen.includes(event)} onCheckedChange={(on) => setChosen((list) => (on ? [...list, event] : list.filter((e) => e !== event)))} aria-label={t.eventLabels[event] ?? event} />
                </label>
              ))}
            </div>
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button onClick={save} loading={saving} disabled={!name.trim() || !url.trim() || chosen.length === 0}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Docs() {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
        {t.webhooks.docs}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-4 border-t p-5 lg:grid-cols-2">
        {[
          [t.webhooks.payload, SAMPLE_PAYLOAD],
          [t.webhooks.verify, SIGNATURE_SNIPPET],
        ].map(([title, code]) => (
          <div key={title} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{title}</span>
              <Button size="icon-sm" variant="ghost" aria-label={ar.common.copy} onClick={() => copy(code)}>
                <Copy />
              </Button>
            </div>
            <pre dir="ltr" className="max-h-80 overflow-auto rounded-xl bg-[#12152a] p-4 text-start text-xs leading-relaxed text-[#e6e8f5]">
              <code>{code}</code>
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}
