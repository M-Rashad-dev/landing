"use client";

import { Check, Receipt, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Meter } from "@/components/data/stat-card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { shownStatus, useInvoices, usePlans, useUsage, type Period, type ShownStatus } from "./billing-api";

const t = ar.settings.billing;
export const INVOICE_TONES: Record<ShownStatus, Tone> = { pending_review: "attention", paid: "success", rejected: "danger", refunded: "info", expired: "neutral" };
const FEATURES = ["store", "upsells", "abandoned_leads", "advanced_analytics", "remove_branding", "buy_themes"] as const;
const LIMITS = ["products", "landing_pages", "offers", "discount_codes", "custom_domains", "media_storage_mb"] as const;

export function BillingPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Current />
        <UsageList />
      </div>
      <Plans />
      <Invoices />
    </div>
  );
}

function Current() {
  const plan = useSession().plan;
  if (!plan) return null;
  return (
    <Panel>
      <PanelHeader title={t.current} />
      <PanelBody className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          {plan.plan?.name ?? "—"}
          {plan.is_trial ? <Badge tone="info">{t.trial}</Badge> : null}
        </p>
        {plan.ends_at ? <p className="text-sm text-ink-2">{t.endsAt(formatDateTime(plan.ends_at).slice(0, 10))}</p> : null}
        <p className={cn("text-sm font-semibold", (plan.days_left ?? 99) <= 7 ? "text-danger" : "text-ink-3")}>{t.daysLeft(plan.days_left ?? 0)}</p>
      </PanelBody>
    </Panel>
  );
}

function UsageList() {
  const query = useUsage();
  return (
    <Panel>
      <PanelHeader title={t.usage} />
      <PanelBody className="flex flex-col gap-3">
        {query.isPending ? (
          <Skeleton className="h-40" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : (
          query.data.map((u) => <Meter key={u.key} used={u.used} limit={u.unlimited ? null : u.limit} label={u.label} />)
        )}
      </PanelBody>
    </Panel>
  );
}

function Plans() {
  const query = usePlans();
  const [period, setPeriod] = React.useState<Period>("monthly");

  return (
    <Panel>
      <PanelHeader
        title={t.plans}
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: "monthly", label: t.monthly },
              { value: "yearly", label: t.yearly },
            ]}
          />
        }
      />
      <PanelBody>
        {query.isPending ? (
          <Skeleton className="h-72" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {query.data.map((plan) => {
              const price = plan.prices[period];
              const current = price?.is_current ?? false;
              return (
                <div
                  key={plan.key}
                  className={cn("flex flex-col gap-3 rounded-xl border p-4", plan.is_highlighted ? "border-brand bg-brand-soft/30" : "border-border", current && "ring-2 ring-brand")}
                >
                  <div>
                    <p className="flex items-center gap-2 text-lg font-bold">
                      {plan.name}
                      {current ? <Badge tone="brand">{t.currentPlan}</Badge> : null}
                    </p>
                    {plan.tagline ? <p className="text-xs text-ink-3">{plan.tagline}</p> : null}
                  </div>
                  {price ? (
                    <p className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold tabular">{formatMoney(price.final)}</span>
                      <span className="text-xs text-ink-3">{period === "monthly" ? t.perMonth : t.perYear}</span>
                      {price.discount_percent > 0 ? <span className="text-sm text-ink-3 line-through tabular">{formatMoney(price.original)}</span> : null}
                    </p>
                  ) : null}
                  <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                    {LIMITS.map((key) => {
                      const v = plan.values[key];
                      return (
                        <li key={key} className="flex justify-between gap-2">
                          <span className="text-ink-2">{t.limits[key]}</span>
                          <span className="font-semibold tabular">{v === null ? t.unlimited : String(v)}</span>
                        </li>
                      );
                    })}
                    {FEATURES.map((key) => (
                      <li key={key} className={cn("flex items-center gap-2", !plan.values[key] && "text-ink-3")}>
                        {plan.values[key] ? <Check className="size-4 text-success" /> : <X className="size-4" />}
                        {t.features[key]}
                      </li>
                    ))}
                  </ul>
                  {price ? (
                    <Button asChild variant={current ? "outline" : plan.is_highlighted ? "primary" : "secondary"}>
                      <Link href={`/dashboard/settings/billing/checkout?plan=${plan.key}&period=${period}`}>{current ? t.renewThis : t.choose}</Link>
                    </Button>
                  ) : null}
                  {price && price.change.credit > 0 && !current ? <p className="text-xs text-ink-3">{t.credit(price.change.credit)}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function Invoices() {
  const query = useInvoices();
  return (
    <Panel>
      <PanelHeader title={t.invoices} description={t.invoicesHint} />
      {query.isPending ? (
        <PanelBody>
          <Skeleton className="h-32" />
        </PanelBody>
      ) : query.isError ? (
        <PanelBody>
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        </PanelBody>
      ) : query.data.data.length === 0 ? (
        <EmptyState compact icon={Receipt} title={t.noInvoices} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data.data.map((inv) => {
            const status = shownStatus(inv);
            return (
              <li key={inv.id}>
                <Link href={`/dashboard/settings/billing/invoices/${inv.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold tabular">{inv.number}</span>
                    <span className="block text-xs text-ink-3">
                      {inv.theme ? inv.theme.name : `${inv.plan.name}${inv.period ? ` · ${inv.period === "monthly" ? t.monthly : t.yearly}` : ""}`} · {formatDateTime(inv.created_at)}
                    </span>
                  </span>
                  <Badge tone={INVOICE_TONES[status]} dot>
                    {t.invoiceStatus[status]}
                  </Badge>
                  <span className="w-24 text-end font-semibold tabular">{formatMoney(inv.total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
