"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import { AI_KEY, saveAiSettings, useAiOverview, type AiOverview, type AiSettings } from "./ai-api";
import { KnowledgePanel } from "./ai-knowledge";

const t = ar.admin.ai;

/** USD with up to 4 decimals (AI calls cost fractions of a cent). */
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;

const number = (min: number, max: number, integer = false) => z.number({ error: t.invalid }).min(min, t.invalid).max(max, t.invalid).refine((n) => !integer || Number.isInteger(n), t.invalid);
const schema = z.object({
  features: z.record(z.string(), z.boolean()),
  daily_cap_usd: number(0, 10000),
  usd_rate: z.number({ error: t.invalid }).min(1, t.invalid).max(10000, t.invalid).nullable(),
  margin_percent: number(0, 500),
  support_daily_messages: number(0, 1000, true),
});
type Values = z.infer<typeof schema>;

/** The owner's AI page: connection, each feature on / off, the limits, and what the AI cost. */
export function AiPage() {
  const query = useAiOverview();
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {query.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-5">
          <Connection data={query.data} />
          <Usage data={query.data} />
          <SettingsForm settings={query.data.settings} />
          <KnowledgePanel />
          <Tables data={query.data} />
        </div>
      )}
    </>
  );
}

function Connection({ data }: { data: AiOverview }) {
  const { status } = data;
  return (
    <Panel>
      <PanelHeader title={t.connection} />
      <PanelBody className="flex flex-col gap-3">
        {status.driver === "fake" ? (
          <Alert tone="info">{t.fake}</Alert>
        ) : status.configured ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Bot className="size-4" aria-hidden />
            {t.connected}
          </p>
        ) : (
          <Alert tone="warning">{t.notConfigured}</Alert>
        )}
        {status.paused_until ? <Alert tone="warning">{t.paused(formatDateTime(status.paused_until))}</Alert> : null}
        {status.limit_reached ? <Alert tone="danger">{t.limitReached}</Alert> : null}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-3">{t.models}:</span>
          {data.models.map((m) => (
            <Badge key={m.model} tone={m.priced ? "neutral" : "warning"} title={m.priced ? undefined : t.unpriced}>
              <span dir="ltr">{m.model}</span>
            </Badge>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

function Usage({ data }: { data: AiOverview }) {
  const { today, month } = data.usage;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StatCard label={t.today} value={usd(today.usd)} hint={`${t.calls(today.calls)}${today.failed ? ` · ${t.failedCalls(today.failed)}` : ""}`} attention={data.status.limit_reached} />
      <StatCard label={t.month} value={usd(month.usd)} hint={`${t.calls(month.calls)}${month.failed ? ` · ${t.failedCalls(month.failed)}` : ""}`} />
    </div>
  );
}

function SettingsForm({ settings }: { settings: AiSettings }) {
  const client = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: settings });
  const { errors, isSubmitting, isDirty } = form.formState;
  const numeric = { setValueAs: (v: string) => (v === "" ? Number.NaN : Number(v)) };

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await saveAiSettings(v);
      client.setQueryData(AI_KEY, saved);
      form.reset(saved.settings);
      toast.success(t.saved);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["daily_cap_usd", "usd_rate", "margin_percent", "support_daily_messages"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) toast.error(unmatched[0] ?? errorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Panel>
        <PanelHeader title={t.features} />
        <PanelBody className="flex flex-col gap-5">
          {Object.keys(settings.features).map((key) => (
            <Controller key={key} control={form.control} name={`features.${key}`} render={({ field }) => <SwitchRow title={t.featureNames[key] ?? key} description={t.featureHints[key]} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          ))}
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <p className="text-sm font-semibold sm:col-span-2">{t.limits}</p>
            <Field label={t.dailyCap} hint={t.dailyCapHint} htmlFor="ai-cap" error={errors.daily_cap_usd?.message}>
              <Input id="ai-cap" type="number" inputMode="decimal" step="0.5" dir="ltr" className="tabular" {...form.register("daily_cap_usd", numeric)} />
            </Field>
            <Field label={t.supportMessages} hint={t.supportMessagesHint} htmlFor="ai-msgs" error={errors.support_daily_messages?.message}>
              <Input id="ai-msgs" type="number" inputMode="numeric" dir="ltr" className="tabular" {...form.register("support_daily_messages", numeric)} />
            </Field>
          </div>
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold">{t.wallet}</p>
              <p className="text-xs text-ink-3">{t.walletHint}</p>
            </div>
            <Field label={t.usdRate} htmlFor="ai-rate" error={errors.usd_rate?.message} optional>
              <Input id="ai-rate" type="number" inputMode="decimal" step="0.01" dir="ltr" className="tabular" {...form.register("usd_rate", { setValueAs: (v: string | number | null) => (v === "" || v === null ? null : Number(v)) })} />
            </Field>
            <Field label={t.margin} htmlFor="ai-margin" error={errors.margin_percent?.message}>
              <Input id="ai-margin" type="number" inputMode="decimal" dir="ltr" className="tabular" {...form.register("margin_percent", numeric)} />
            </Field>
          </div>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      </Panel>
    </form>
  );
}

function Tables({ data }: { data: AiOverview }) {
  const { by_feature, top_stores, failures } = data.usage;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <PanelHeader title={t.byFeature} />
        <PanelBody>
          {by_feature.length === 0 ? (
            <EmptyState title={t.noUsage} />
          ) : (
            <Rows head={[t.feature, t.cost]} rows={by_feature.map((r) => [t.featureNames[r.feature] ?? r.feature, `${usd(r.usd)} · ${t.calls(r.calls)}`])} />
          )}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title={t.topStores} />
        <PanelBody>
          {top_stores.length === 0 ? <EmptyState title={t.noUsage} /> : <Rows head={[t.store, t.cost]} rows={top_stores.map((r) => [r.name || `#${r.tenant_id}`, `${usd(r.usd)} · ${t.calls(r.calls)}`])} />}
        </PanelBody>
      </Panel>
      <Panel className="lg:col-span-2">
        <PanelHeader title={t.failures} />
        <PanelBody>
          {failures.length === 0 ? (
            <EmptyState title={t.noFailures} />
          ) : (
            <Rows head={[t.time, t.feature, t.error]} rows={failures.map((f) => [formatDateTime(f.at), t.featureNames[f.feature] ?? f.feature, f.error ?? "—"])} />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

function Rows({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-ink-3">
            {head.map((h) => (
              <th key={h} className="pb-2 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pe-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
