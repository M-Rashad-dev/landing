"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Clock, PackageX, PhoneCall, ShoppingCart, Tag, Truck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DailyAreaChart, RankBars } from "@/components/data/charts";
import { Checklist } from "@/components/data/details";
import { StatCard } from "@/components/data/stat-card";
import { OrderStatusBadge, type OrderStatus } from "@/components/domain/order-status";
import { DateRangePicker, presetRange, type RangeValue } from "@/components/forms/date-pickers";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { DASHBOARD_NAV, DASHBOARD_FOOTER_NAV } from "@/config/navigation";
import type { OrderRow } from "@/features/orders/api";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";

const t = ar.home;

type Kpis = { orders: number; sales: number; delivered_sales: number; average_order: number; confirmation_rate: number; delivery_rate: number; return_rate: number; new_customers: number };
type SetupKey = "product" | "shipping" | "store" | "domain";
type Home = {
  range: { from: string; to: string; days: number; previous_from: string; previous_to: string };
  kpis: Kpis;
  previous: Kpis;
  chart: Array<{ date: string; orders: number; sales: number }>;
  statuses: Record<OrderStatus, number>;
  top_products: Array<{ product_id: number | null; name: string; units: number; sales: number }>;
  top_governorates: Array<{ governorate: string; orders: number; sales: number }>;
  sources: { store: { orders: number; sales: number }; landing: { orders: number; sales: number } };
  latest_orders: OrderRow[];
  todo: { to_confirm: number; stale_shipments: number; abandoned: number | null; out_of_stock: number; low_stock: number; ending_promotions: number };
  setup: { steps: Array<{ key: SetupKey; done: boolean; optional: boolean }>; done: boolean };
};

/** Where each setup step is done (null = its page is not built yet). */
const SETUP_LINKS: Record<SetupKey, string> = {
  product: "/dashboard/catalog/products/new",
  shipping: "/dashboard/shipping",
  store: "/dashboard/design/theme",
  domain: "/dashboard/settings",
};
const READY = new Set([...DASHBOARD_NAV.flatMap((g) => g.items), ...DASHBOARD_FOOTER_NAV].filter((i) => i.status === "ready").map((i) => i.href));
const ready = (href: string) => READY.has(href) || [...READY].some((h) => h !== "/dashboard" && href.startsWith(`${h}/`));

/** % change against the previous period (null when there is nothing to compare with). */
const change = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : ((now - before) / before) * 100);
/** Rates compare in points; nothing to compare with when the previous period had no orders. */
const points = (now: number, before: number, previousOrders: number) => (previousOrders === 0 ? null : Math.round((now - before) * 10) / 10);
const pretty = (day: string) => formatDateTime(`${day}T12:00:00Z`).slice(0, 10);

export function HomePage() {
  const session = useSession();
  const [url, setUrl] = useUrlState(["from", "to", "preset"] as const);
  const range: RangeValue = url.from ? { from: url.from, to: url.to || url.from, preset: (url.preset as RangeValue["preset"]) || "custom" } : { ...presetRange("last30"), preset: "last30" };

  const query = useQuery({
    queryKey: ["home", range.from, range.to],
    queryFn: () => api<Home>("/dashboard/home", { query: { from: range.from, to: range.to } }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const k = data?.kpis;
  const p = data?.previous;
  const loading = query.isPending;
  const firstName = (session.user?.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? t.greeting(firstName) : t.title}
        description={data ? `${t.period(pretty(data.range.from), pretty(data.range.to))} · ${t.vsPrevious(pretty(data.range.previous_from), pretty(data.range.previous_to))}` : t.description}
        actions={<DateRangePicker value={range} onChange={(r) => (r.preset === "last30" ? setUrl({ from: null, to: null, preset: null }) : setUrl({ from: r.from || null, to: r.to || null, preset: r.preset }))} />}
      />

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-4">
          {data && !data.setup.done ? <Setup steps={data.setup.steps} /> : null}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard loading={loading} label={t.kpis.sales} value={formatMoney(k?.sales ?? 0)} change={k && p ? change(k.sales, p.sales) : undefined} hint={t.kpis.salesHint} />
            <StatCard loading={loading} label={t.kpis.orders} value={formatNumber(k?.orders ?? 0)} change={k && p ? change(k.orders, p.orders) : undefined} href="/dashboard/orders" />
            <StatCard loading={loading} label={t.kpis.averageOrder} value={formatMoney(k?.average_order ?? 0)} change={k && p ? change(k.average_order, p.average_order) : undefined} />
            <StatCard loading={loading} label={t.kpis.deliveredSales} value={formatMoney(k?.delivered_sales ?? 0)} change={k && p ? change(k.delivered_sales, p.delivered_sales) : undefined} />
            <StatCard loading={loading} label={t.kpis.confirmationRate} value={formatPercent(k?.confirmation_rate ?? 0)} change={k && p ? points(k.confirmation_rate, p.confirmation_rate, p.orders) : undefined} hint={t.kpis.confirmationHint} />
            <StatCard loading={loading} label={t.kpis.deliveryRate} value={formatPercent(k?.delivery_rate ?? 0)} change={k && p ? points(k.delivery_rate, p.delivery_rate, p.orders) : undefined} />
            <StatCard loading={loading} label={t.kpis.returnRate} value={formatPercent(k?.return_rate ?? 0)} change={k && p ? points(k.return_rate, p.return_rate, p.orders) : undefined} inverse />
            <StatCard loading={loading} label={t.kpis.newCustomers} value={formatNumber(k?.new_customers ?? 0)} change={k && p ? change(k.new_customers, p.new_customers) : undefined} href="/dashboard/customers" />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1fr_22rem]">
            <SalesChart data={data} loading={loading} />
            <Todo todo={data?.todo} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Panel>
              <PanelHeader title={t.topProducts} />
              <PanelBody>{loading || !data ? <Skeleton className="h-40" /> : <RankBars items={data.top_products.map((x) => ({ label: x.name, value: x.units, hint: formatMoney(x.sales) }))} format={(v) => t.units(v)} />}</PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.topGovernorates} />
              <PanelBody>{loading || !data ? <Skeleton className="h-40" /> : <RankBars items={data.top_governorates.map((x) => ({ label: x.governorate, value: x.orders, hint: formatMoney(x.sales) }))} format={(v) => t.ordersCount(v)} />}</PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.statuses} />
              <PanelBody className="flex flex-col gap-4">
                {loading || !data ? (
                  <Skeleton className="h-40" />
                ) : (
                  <>
                    <ul className="flex flex-col gap-2 text-sm">
                      {(Object.entries(data.statuses) as Array<[OrderStatus, number]>)
                        .filter(([, n]) => n > 0)
                        .map(([status, n]) => (
                          <li key={status} className="flex items-center justify-between">
                            <OrderStatusBadge status={status} />
                            <span className="font-semibold tabular">{formatNumber(n)}</span>
                          </li>
                        ))}
                      {Object.values(data.statuses).every((n) => n === 0) ? <li className="text-ink-3">{t.noData}</li> : null}
                    </ul>
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-xs font-semibold text-ink-3">{t.sources}</p>
                      <RankBars
                        items={[
                          { label: ar.domain.source.store, value: data.sources.store.orders, hint: formatMoney(data.sources.store.sales) },
                          { label: ar.domain.source.landing, value: data.sources.landing.orders, hint: formatMoney(data.sources.landing.sales) },
                        ].filter((x) => x.value > 0)}
                        format={(v) => t.ordersCount(v)}
                      />
                    </div>
                  </>
                )}
              </PanelBody>
            </Panel>
          </div>

          <Panel>
            <PanelHeader
              title={t.latest}
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/orders">
                    {t.viewAll}
                    <ArrowLeft />
                  </Link>
                </Button>
              }
            />
            {loading || !data ? (
              <PanelBody>
                <Skeleton className="h-40" />
              </PanelBody>
            ) : data.latest_orders.length === 0 ? (
              <PanelBody className="text-sm text-ink-3">{ar.orders.emptyText}</PanelBody>
            ) : (
              <ul className="divide-y divide-border">
                {data.latest_orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          <span className="tabular">#{o.order_number}</span> · {o.customer_name}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          {ar.orders.itemsSummary(o.items_summary?.first ?? null, o.items_summary?.count ?? 0)} · {formatDateTime(o.created_at)}
                        </span>
                      </span>
                      <OrderStatusBadge status={o.status} />
                      <span className="w-24 text-end font-semibold tabular">{formatMoney(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function SalesChart({ data, loading }: { data?: Home; loading: boolean }) {
  const [metric, setMetric] = React.useState<"sales" | "orders">("sales");
  return (
    <Panel>
      <PanelHeader
        title={t.chart.title}
        actions={
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "sales", label: t.chart.sales },
              { value: "orders", label: t.chart.orders },
            ]}
          />
        }
      />
      <PanelBody>
        {loading || !data ? (
          <Skeleton className="h-60" />
        ) : (
          <DailyAreaChart data={data.chart} series={{ key: metric, label: t.chart[metric] }} format={metric === "sales" ? (v) => formatMoney(v) : formatNumber} />
        )}
      </PanelBody>
    </Panel>
  );
}

function Todo({ todo }: { todo?: Home["todo"] }) {
  const s = t.todo;
  if (!todo) {
    return (
      <Panel>
        <PanelHeader title={s.title} />
        <PanelBody>
          <Skeleton className="h-40" />
        </PanelBody>
      </Panel>
    );
  }
  const items = [
    todo.to_confirm > 0 && { icon: PhoneCall, text: s.toConfirm(todo.to_confirm), href: "/dashboard/orders/confirm", action: s.toConfirmAction, tone: "attention" as const },
    todo.stale_shipments > 0 && { icon: Truck, text: s.stale(todo.stale_shipments), href: "/dashboard/orders?tab=shipped&sort=oldest", action: s.staleAction, tone: "warning" as const },
    todo.abandoned && todo.abandoned > 0 && { icon: ShoppingCart, text: s.abandoned(todo.abandoned), href: "/dashboard/abandoned", action: s.abandonedAction, tone: "info" as const },
    todo.out_of_stock > 0 && { icon: PackageX, text: s.out(todo.out_of_stock), href: "/dashboard/catalog/products?status=out", action: s.stockAction, tone: "danger" as const },
    todo.low_stock > 0 && { icon: AlertTriangle, text: s.low(todo.low_stock), href: "/dashboard/catalog/products?status=low", action: s.stockAction, tone: "warning" as const },
    todo.ending_promotions > 0 && { icon: Clock, text: s.ending(todo.ending_promotions), href: "/dashboard/marketing/offers", action: s.endingAction, tone: "neutral" as const },
  ].filter(Boolean) as Array<{ icon: typeof Tag; text: string; href: string; action: string; tone: "attention" | "warning" | "info" | "danger" | "neutral" }>;

  return (
    <Panel>
      <PanelHeader title={s.title} />
      {items.length === 0 ? (
        <PanelBody className="text-sm text-ink-2">{s.allClear}</PanelBody>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                <Badge tone={item.tone} className="size-8 justify-center p-0">
                  <item.icon className="!size-4" />
                </Badge>
                <span className="flex-1 text-sm">{item.text}</span>
                <span className="text-xs font-semibold text-brand-strong">{item.action}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Setup({ steps }: { steps: Home["setup"]["steps"] }) {
  const s = t.setup;
  return (
    <Panel>
      <PanelHeader title={s.title} description={s.description} />
      <PanelBody>
        <Checklist
          items={steps.map((step) => ({
            label: step.optional ? `${s.steps[step.key]} (${s.optional})` : s.steps[step.key],
            done: step.done,
            action: ready(SETUP_LINKS[step.key]) ? (
              <Button asChild size="sm" variant={step.optional ? "ghost" : "outline"}>
                <Link href={SETUP_LINKS[step.key]}>{s.go}</Link>
              </Button>
            ) : (
              <Badge size="sm">{s.soon}</Badge>
            ),
          }))}
        />
      </PanelBody>
    </Panel>
  );
}
