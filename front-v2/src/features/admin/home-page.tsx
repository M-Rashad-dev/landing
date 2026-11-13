"use client";

import { CalendarClock, CheckCircle2, ReceiptText, Store, Undo2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DailyAreaChart, RankBars } from "@/components/data/charts";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar, Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useAdminOverview, type AdminOverview } from "./api";

const t = ar.admin.home;
const at = ar.admin.attention;

const change = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : ((now - before) / before) * 100);

export function AdminHome() {
  const query = useAdminOverview();
  const data = query.data;
  const loading = query.isPending;

  if (query.isError) {
    return (
      <>
        <PageHeader title={t.title} description={t.description} />
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="flex flex-col gap-4">
        <Attention data={data} loading={loading} />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard loading={loading} label={t.kpis.sales} value={formatMoney(data?.activity.sales_month ?? 0)} change={data ? change(data.activity.sales_month, data.activity.sales_previous) : undefined} />
          <StatCard
            loading={loading}
            label={t.kpis.orders}
            value={formatNumber(data?.activity.orders_month ?? 0)}
            change={data ? change(data.activity.orders_month, data.activity.orders_previous) : undefined}
            hint={data ? t.kpis.ordersToday(data.activity.orders_today) : undefined}
          />
          <StatCard loading={loading} label={t.kpis.revenue} value={formatMoney(data?.billing.revenue_month ?? 0)} change={data ? change(data.billing.revenue_month, data.billing.revenue_previous) : undefined} />
          <StatCard loading={loading} label={t.kpis.newStores} value={formatNumber(data?.stores.new_month ?? 0)} hint={data ? t.kpis.newWeek(data.stores.new_week) : undefined} href="/admin/stores" />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1fr_22rem]">
          <TrendPanel data={data} loading={loading} />
          <StoresPanel data={data} loading={loading} />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TopStores data={data} loading={loading} />
          <Panel>
            <PanelHeader title={t.subscriptions.plans} />
            <PanelBody>
              {loading || !data ? (
                <Skeleton className="h-32" />
              ) : data.subscriptions.plans.length === 0 ? (
                <EmptyState compact title={t.subscriptions.noPlans} />
              ) : (
                <RankBars items={data.subscriptions.plans.map((p) => ({ label: p.name, value: p.total }))} />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Attention({ data, loading }: { data?: AdminOverview; loading: boolean }) {
  if (loading || !data) return <Skeleton className="h-16 rounded-xl" />;
  const pending = data.billing.pending_payments;
  const refunds = data.billing.refund_requests;
  const expiring = data.subscriptions.expiring_week;

  if (pending + refunds + expiring === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-2">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        {at.none}
      </p>
    );
  }

  const items = [
    { key: "payments", show: pending > 0, icon: ReceiptText, label: at.payments(pending), href: null, tone: "bg-accent-soft text-accent-ink" },
    { key: "refunds", show: refunds > 0, icon: Undo2, label: at.refunds(refunds), href: null, tone: "bg-danger-soft text-danger" },
    { key: "expiring", show: expiring > 0, icon: CalendarClock, label: at.expiring(expiring), href: "/admin/stores?tab=expiring", tone: "bg-info-soft text-info" },
  ].filter((i) => i.show);

  return (
    <section aria-label={at.title} className="rounded-xl border border-accent/60 bg-accent-soft/40 p-3">
      <p className="mb-2 px-1 text-[13px] font-semibold">{at.title}</p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {items.map(({ key, icon: Icon, label, href, tone }) => {
          const body = (
            <>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{label}</span>
                {href ? null : <span className="text-[11px] text-ink-3">{at.soonHint}</span>}
              </span>
            </>
          );
          return (
            <li key={key}>
              {href ? (
                <Link href={href} className="flex h-full items-center gap-3 rounded-lg bg-surface p-3 transition-colors hover:bg-surface-2">
                  {body}
                </Link>
              ) : (
                <span className="flex h-full items-center gap-3 rounded-lg bg-surface p-3">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TrendPanel({ data, loading }: { data?: AdminOverview; loading: boolean }) {
  const [metric, setMetric] = React.useState<"sales" | "orders" | "stores">("sales");
  return (
    <Panel>
      <PanelHeader
        title={t.trend.title}
        actions={
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "sales", label: t.trend.sales },
              { value: "orders", label: t.trend.orders },
              { value: "stores", label: t.trend.stores },
            ]}
          />
        }
      />
      <PanelBody>{loading || !data ? <Skeleton className="h-64" /> : <DailyAreaChart data={data.days} series={{ key: metric, label: t.trend[metric] }} height={260} format={metric === "sales" ? formatMoney : formatNumber} />}</PanelBody>
    </Panel>
  );
}

function StoresPanel({ data, loading }: { data?: AdminOverview; loading: boolean }) {
  const s = t.subscriptions;
  const rows = data
    ? [
        { label: s.trials, value: data.subscriptions.trials, href: "/admin/stores?tab=trial" },
        { label: s.paying, value: data.subscriptions.paying, href: "/admin/stores?tab=paying" },
        { label: s.gifted, value: data.subscriptions.gifted, href: "/admin/stores?tab=gifted" },
        { label: s.expiring, value: data.subscriptions.expiring_week, href: "/admin/stores?tab=expiring" },
        { label: s.expired, value: data.subscriptions.expired, href: "/admin/stores?tab=expired" },
      ]
    : [];
  return (
    <Panel>
      <PanelHeader
        title={t.stores.title}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/stores">{t.stores.open}</Link>
          </Button>
        }
      />
      <PanelBody className="flex flex-col gap-4">
        {loading || !data ? (
          <Skeleton className="h-56" />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: t.stores.total, value: data.stores.total, tone: "text-ink" },
                { label: t.stores.active, value: data.stores.active, tone: "text-success" },
                { label: t.stores.suspended, value: data.stores.suspended, tone: data.stores.suspended ? "text-danger" : "text-ink-3" },
              ].map((c) => (
                <div key={c.label} className="rounded-lg bg-surface-2 px-2 py-3">
                  <dt className="text-[11px] text-ink-3">{c.label}</dt>
                  <dd className={cn("tabular font-display text-xl font-semibold", c.tone)}>{formatNumber(c.value)}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-1 text-[13px] font-semibold">{s.title}</p>
              <ul className="flex flex-col">
                {rows.map((r) => (
                  <li key={r.label}>
                    <Link href={r.href} className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-surface-2">
                      <span className="text-ink-2">{r.label}</span>
                      <span className="tabular font-semibold">{formatNumber(r.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

function TopStores({ data, loading }: { data?: AdminOverview; loading: boolean }) {
  return (
    <Panel>
      <PanelHeader title={t.top.title} />
      <PanelBody>
        {loading || !data ? (
          <Skeleton className="h-40" />
        ) : data.top_stores.length === 0 ? (
          <EmptyState compact icon={Store} title={t.top.empty} />
        ) : (
          <ol className="flex flex-col">
            {data.top_stores.map((s, i) => (
              <li key={s.id}>
                <Link href={`/admin/stores/${s.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <span className="tabular w-4 text-center text-xs font-semibold text-ink-3">{i + 1}</span>
                  <Avatar name={s.name} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{s.name}</span>
                    <span className="text-xs text-ink-3">{t.top.orders(s.orders)}</span>
                  </span>
                  <span className="tabular text-sm font-semibold">{formatMoney(s.sales)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}
