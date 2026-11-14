"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Laptop, Smartphone } from "lucide-react";
import * as React from "react";
import { DailyAreaChart, Funnel, RankBars } from "@/components/data/charts";
import { EntityCell } from "@/components/data/details";
import { StatCard } from "@/components/data/stat-card";
import { DateRangePicker, presetRange, type RangeValue } from "@/components/forms/date-pickers";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.analytics;

type Totals = {
  views: number;
  product_views: number;
  add_to_cart: number;
  checkouts: number;
  orders: number;
  revenue: number;
  average_order: number;
  conversion: number | null;
  cart_rate: number | null;
  checkout_rate: number | null;
  delivered: number;
  customers: number;
  new_customers: number;
  returning_customers: number;
  abandoned: number;
  recovered: number;
};

/** back end: Dashboard\StoreAnalyticsController */
export type Analytics = {
  range: { from: string; to: string; days: number; previous_from: string; previous_to: string };
  totals: Totals;
  previous: Totals;
  days: Array<{ date: string; views: number; product_views: number; add_to_cart: number; checkouts: number; orders: number; revenue: number }>;
  sources: Array<{ source: string; views: number; orders: number; revenue: number; conversion: number | null }>;
  devices: Array<{ device: "mobile" | "desktop"; views: number }>;
  top_products: Array<{ product_id: number | null; name: string; units: number; orders: number; revenue: number; image: Record<string, string> | null }>;
  governorates: Array<{ governorate: string; orders: number; revenue: number }>;
  hours: number[];
};

/** % change against the previous period (null: nothing to compare with). */
const change = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : ((now - before) / before) * 100);
/** Rates compare in points. */
const points = (now: number | null, before: number | null) => (now === null || before === null ? null : Math.round((now - before) * 10) / 10);
const pretty = (day: string) => formatDateTime(`${day}T12:00:00Z`).slice(0, 10);

export function AnalyticsPage() {
  const [url, setUrl] = useUrlState(["from", "to", "preset"] as const);
  const range: RangeValue = url.from ? { from: url.from, to: url.to || url.from, preset: (url.preset as RangeValue["preset"]) || "custom" } : { ...presetRange("last30"), preset: "last30" };
  const query = useQuery({
    queryKey: ["store-analytics", range.from, range.to],
    queryFn: () => api<Analytics>("/dashboard/store/analytics", { query: { from: range.from, to: range.to } }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const k = data?.totals;
  const p = data?.previous;
  const loading = query.isPending;

  return (
    <>
      <PageHeader
        title={t.title}
        description={data ? `${t.period(pretty(data.range.from), pretty(data.range.to))} · ${t.vsPrevious(pretty(data.range.previous_from), pretty(data.range.previous_to))}` : t.description}
        actions={<DateRangePicker value={range} onChange={(r) => (r.preset === "last30" ? setUrl({ from: null, to: null, preset: null }) : setUrl({ from: r.from || null, to: r.to || null, preset: r.preset }))} />}
      />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard loading={loading} label={t.kpis.revenue} value={formatMoney(k?.revenue ?? 0)} change={k && p ? change(k.revenue, p.revenue) : undefined} hint={t.kpis.revenueHint} />
            <StatCard loading={loading} label={t.kpis.orders} value={formatNumber(k?.orders ?? 0)} change={k && p ? change(k.orders, p.orders) : undefined} href="/dashboard/orders" />
            <StatCard loading={loading} label={t.kpis.views} value={formatNumber(k?.views ?? 0)} change={k && p ? change(k.views, p.views) : undefined} />
            <StatCard loading={loading} label={t.kpis.conversion} value={k?.conversion === null || !k ? "—" : formatPercent(k.conversion)} change={k && p ? points(k.conversion, p.conversion) : undefined} hint={t.kpis.conversionHint} />
            <StatCard loading={loading} label={t.kpis.averageOrder} value={formatMoney(k?.average_order ?? 0)} change={k && p ? change(k.average_order, p.average_order) : undefined} />
            <StatCard loading={loading} label={t.kpis.cartRate} value={k?.cart_rate === null || !k ? "—" : formatPercent(k.cart_rate)} change={k && p ? points(k.cart_rate, p.cart_rate) : undefined} hint={t.kpis.cartRateHint} />
            <StatCard loading={loading} label={t.kpis.newCustomers} value={formatNumber(k?.new_customers ?? 0)} change={k && p ? change(k.new_customers, p.new_customers) : undefined} href="/dashboard/customers" />
            <StatCard loading={loading} label={t.kpis.abandoned} value={formatNumber(k?.abandoned ?? 0)} change={k && p ? change(k.abandoned, p.abandoned) : undefined} inverse hint={k ? t.kpis.recovered(k.recovered) : undefined} href="/dashboard/abandoned" />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1fr_24rem]">
            <TrendPanel data={data} loading={loading} />
            <Panel>
              <PanelHeader title={t.funnel.title} description={t.funnel.hint} />
              <PanelBody>
                {loading || !k ? (
                  <Skeleton className="h-48" />
                ) : (
                  <Funnel
                    steps={[
                      { label: t.funnel.views, value: k.views },
                      { label: t.funnel.productViews, value: k.product_views },
                      { label: t.funnel.addToCart, value: k.add_to_cart },
                      { label: t.funnel.checkouts, value: k.checkouts },
                      { label: t.funnel.orders, value: k.orders },
                    ]}
                  />
                )}
              </PanelBody>
            </Panel>
          </div>

          <SourcesPanel data={data} loading={loading} />

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Panel>
              <PanelHeader title={t.devices.title} />
              <PanelBody>{loading || !data ? <Skeleton className="h-28" /> : <Devices devices={data.devices} />}</PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.customers.title} />
              <PanelBody>
                {loading || !k ? (
                  <Skeleton className="h-28" />
                ) : (
                  <dl className="grid grid-cols-2 gap-3">
                    <Metric label={t.customers.new} value={k.new_customers} />
                    <Metric label={t.customers.returning} value={k.returning_customers} />
                    <Metric label={t.customers.abandoned} value={k.abandoned} />
                    <Metric label={t.customers.recovered} value={k.recovered} />
                  </dl>
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.governorates.title} />
              <PanelBody>{loading || !data ? <Skeleton className="h-28" /> : <RankBars items={data.governorates.map((g) => ({ label: g.governorate, value: g.orders, hint: formatMoney(g.revenue) }))} format={(v) => t.governorates.orders(v)} />}</PanelBody>
            </Panel>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title={t.topProducts.title} />
              <PanelBody>{loading || !data ? <Skeleton className="h-48" /> : <TopProducts rows={data.top_products} />}</PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.hours.title} description={t.hours.hint} />
              <PanelBody>{loading || !data ? <Skeleton className="h-48" /> : <Hours hours={data.hours} />}</PanelBody>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function TrendPanel({ data, loading }: { data?: Analytics; loading: boolean }) {
  const [metric, setMetric] = React.useState<"revenue" | "orders" | "views">("revenue");
  return (
    <Panel>
      <PanelHeader
        title={t.chart.title}
        actions={
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "revenue", label: t.chart.revenue },
              { value: "orders", label: t.chart.orders },
              { value: "views", label: t.chart.views },
            ]}
          />
        }
      />
      <PanelBody>{loading || !data ? <Skeleton className="h-64" /> : <DailyAreaChart data={data.days} series={{ key: metric, label: t.chart[metric] }} height={260} format={metric === "revenue" ? formatMoney : formatNumber} />}</PanelBody>
    </Panel>
  );
}

function SourcesPanel({ data, loading }: { data?: Analytics; loading: boolean }) {
  const c = t.sources.columns;
  const rows = data?.sources.filter((s) => s.views > 0 || s.orders > 0) ?? [];
  const max = Math.max(1, ...rows.map((s) => s.views));
  return (
    <Panel>
      <PanelHeader title={t.sources.title} description={t.sources.hint} />
      <PanelBody>
        {loading || !data ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <EmptyState title={t.noData} compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-[13px]">
              <thead>
                <tr className="text-start text-xs text-ink-3">
                  <th className="pb-2 text-start font-medium">{c.source}</th>
                  <th className="w-[35%] pb-2 text-start font-medium">{c.views}</th>
                  <th className="pb-2 text-end font-medium">{c.orders}</th>
                  <th className="pb-2 text-end font-medium">{c.conversion}</th>
                  <th className="pb-2 text-end font-medium">{c.revenue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => (
                  <tr key={s.source}>
                    <td className="py-2.5 font-semibold">{t.sources.names[s.source] ?? s.source}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(2, (s.views / max) * 100)}%` }} />
                        </span>
                        <span className="tabular w-12 text-end">{formatNumber(s.views)}</span>
                      </span>
                    </td>
                    <td className="tabular py-2.5 text-end">{formatNumber(s.orders)}</td>
                    <td className="tabular py-2.5 text-end">{s.conversion === null ? "—" : formatPercent(s.conversion)}</td>
                    <td className="tabular py-2.5 text-end font-semibold">{formatMoney(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function Devices({ devices }: { devices: Analytics["devices"] }) {
  const total = devices.reduce((sum, d) => sum + d.views, 0);
  if (total === 0) return <EmptyState title={t.noData} compact />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {devices.map((d, i) => (
          <span key={d.device} className={i === 0 ? "bg-ink" : "bg-brand"} style={{ width: `${(d.views / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-[13px]">
        {devices.map((d, i) => {
          const Icon = d.device === "mobile" ? Smartphone : Laptop;
          return (
            <li key={d.device} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", i === 0 ? "bg-ink" : "bg-brand")} aria-hidden />
              <Icon className="size-4 text-ink-3" aria-hidden />
              <span className="flex-1">{t.devices[d.device]}</span>
              <span className="tabular text-ink-3">{formatNumber(d.views)}</span>
              <span className="tabular w-12 text-end font-semibold">{formatPercent((d.views / total) * 100)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2/60 p-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tabular font-display text-xl font-semibold">{formatNumber(value)}</dd>
    </div>
  );
}

function TopProducts({ rows }: { rows: Analytics["top_products"] }) {
  if (rows.length === 0) return <EmptyState title={t.noData} compact />;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {rows.map((r, i) => (
        <li key={`${r.product_id}-${i}`} className="flex items-center gap-3 py-2.5">
          <span className="tabular w-5 text-center text-xs text-ink-3">{i + 1}</span>
          <EntityCell className="min-w-0 flex-1" image={r.image?.thumb ?? null} title={r.name} subtitle={`${t.topProducts.units(r.units)} · ${t.topProducts.orders(r.orders)}`} />
          <span className="tabular text-[13px] font-semibold">{formatMoney(r.revenue)}</span>
        </li>
      ))}
    </ol>
  );
}

/** 24 bars: when in the day the orders come (the busiest hour is marked). */
function Hours({ hours }: { hours: number[] }) {
  const max = Math.max(...hours);
  if (max === 0) return <EmptyState title={t.noData} compact />;
  const peak = hours.indexOf(max);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-36 items-end gap-0.5" dir="ltr" role="img" aria-label={t.hours.peak(t.hours.hour(peak))}>
        {hours.map((n, h) => (
          <div key={h} className="group relative flex h-full flex-1 items-end">
            <span className={cn("w-full rounded-t-sm", h === peak ? "bg-brand" : "bg-ink/70")} style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full start-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block" dir="rtl">
              {t.hours.hour(h)}: {formatNumber(n)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-ink-3" dir="ltr">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{t.hours.hour(h)}</span>
        ))}
      </div>
      <p className="text-[13px] font-semibold">{t.hours.peak(t.hours.hour(peak))}</p>
    </div>
  );
}
