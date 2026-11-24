"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { MultiLineChart } from "@/components/data/charts";
import { Pagination } from "@/components/data/data-table";
import { StatCard } from "@/components/data/stat-card";
import { MoneyInput } from "@/components/forms/inputs";
import { DateRangePicker, presetRange, type RangeValue } from "@/components/forms/date-pickers";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { deleteExpense, savePackaging, useExpenses, useProfit, useProfitSettings, useRefreshProfit, type Expense, type ProfitData } from "./api";
import { ExpenseDrawer, type ExpenseDrawerState } from "./expense-drawer";

const t = ar.profit;
const pretty = (day: string) => formatDateTime(`${day}T12:00:00Z`).slice(0, 10);

export function ProfitPage() {
  const [url, setUrl] = useUrlState(["from", "to", "preset"] as const);
  const range: RangeValue = url.from ? { from: url.from, to: url.to || url.from, preset: (url.preset as RangeValue["preset"]) || "custom" } : { ...presetRange("last30"), preset: "last30" };
  const query = useProfit(range.from, range.to);
  const data = query.data;
  const loading = query.isPending;
  const canExpenses = useCan()("profit.expenses");

  return (
    <>
      <PageHeader
        title={t.title}
        description={data ? t.period(pretty(data.from), pretty(data.to)) : t.description}
        actions={<DateRangePicker value={range} onChange={(r) => (r.preset === "last30" ? setUrl({ from: null, to: null, preset: null }) : setUrl({ from: r.from || null, to: r.to || null, preset: r.preset }))} />}
      />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          {data && data.missing_cost_orders > 0 ? (
            <Alert
              tone="warning"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/catalog/products">{t.missingCostAction}</Link>
                </Button>
              }
            >
              {t.missingCost(data.missing_cost_orders)}
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard loading={loading} label={t.kpis.net} value={formatMoney(data?.net_profit ?? 0)} hint={t.kpis.netHint} attention={!!data && data.net_profit < 0} />
            <StatCard loading={loading} label={t.kpis.actual} value={formatMoney(data?.actual.profit ?? 0)} hint={data ? t.kpis.actualHint(data.actual.orders) : undefined} />
            <StatCard loading={loading} label={t.kpis.expected} value={formatMoney(data?.expected.profit ?? 0)} hint={data ? t.kpis.expectedHint(data.expected.orders) : undefined} href="/dashboard/orders" />
            <StatCard loading={loading} label={t.kpis.margin} value={data?.margin === null || !data ? "—" : formatPercent(data.margin)} hint={t.kpis.marginHint} />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1fr_24rem]">
            <Panel>
              <PanelHeader title={t.chart.title} />
              <PanelBody>
                {loading || !data ? (
                  <Skeleton className="h-64" />
                ) : (
                  <MultiLineChart
                    data={data.chart}
                    series={[
                      { key: "profit", label: t.chart.profit },
                      { key: "expenses", label: t.chart.expenses },
                      { key: "net", label: t.chart.net },
                    ]}
                    height={260}
                    format={formatMoney}
                  />
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.breakdown.title} description={t.breakdown.hint} />
              <PanelBody>{loading || !data ? <Skeleton className="h-64" /> : <Breakdown data={data} />}</PanelBody>
            </Panel>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title={t.products.title} description={t.products.hint} />
              <PanelBody>{loading || !data ? <Skeleton className="h-48" /> : <Products rows={data.products} />}</PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t.sources.title} description={t.sources.hint} />
              <PanelBody>{loading || !data ? <Skeleton className="h-48" /> : <Sources rows={data.sources} />}</PanelBody>
            </Panel>
          </div>

          <ExpensesPanel from={range.from} to={range.to} canEdit={canExpenses} />
          {canExpenses ? <PackagingPanel /> : null}
        </div>
      )}
    </>
  );
}

function Breakdown({ data }: { data: ProfitData }) {
  const b = t.breakdown;
  const a = data.actual;
  const rows: Array<{ label: string; value: number; minus?: boolean; strong?: boolean }> = [
    { label: b.revenue, value: a.revenue },
    ...((a.refunds ?? 0) > 0 ? [{ label: b.refunds, value: a.refunds ?? 0, minus: true }] : []),
    { label: b.productCost, value: a.product_cost, minus: true },
    { label: b.shipping, value: a.shipping_cost, minus: true },
    { label: b.cod, value: a.cod_fee, minus: true },
    { label: b.packaging, value: a.packaging, minus: true },
    { label: b.profit, value: a.profit, strong: true },
    { label: b.expenses, value: data.expenses.total, minus: true },
    { label: b.net, value: data.net_profit, strong: true },
  ];
  return (
    <dl className="flex flex-col divide-y divide-border text-[13px]">
      {rows.map((r) => (
        <div key={r.label} className={cn("flex items-center justify-between py-2", r.strong && "font-semibold")}>
          <dt className={r.strong ? undefined : "text-ink-2"}>{r.label}</dt>
          <dd className={cn("tabular", r.strong && r.value < 0 && "text-danger")}>{r.minus && r.value > 0 ? `− ${formatMoney(r.value)}` : formatMoney(r.value)}</dd>
        </div>
      ))}
      {data.expenses.by_kind.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {data.expenses.by_kind.map((k) => (
            <Badge key={k.kind} tone="neutral">
              {k.label}: {formatMoney(k.amount)}
            </Badge>
          ))}
        </div>
      ) : null}
    </dl>
  );
}

function Products({ rows }: { rows: ProfitData["products"] }) {
  if (rows.length === 0) return <EmptyState title={t.noData} compact />;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {rows.map((r, i) => (
        <li key={`${r.product_id}-${i}`} className="flex items-center gap-3 py-2.5 text-[13px]">
          <span className="tabular w-5 text-center text-xs text-ink-3">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{r.name}</span>
            <span className="text-xs text-ink-3">
              {t.products.units(r.units)} · {formatMoney(r.revenue)}
            </span>
          </span>
          {r.cost_known ? null : <Badge tone="warning">{t.products.noCost}</Badge>}
          <span className="text-end">
            <span className="tabular block font-semibold">{formatMoney(r.profit)}</span>
            {r.margin === null ? null : <span className="tabular text-xs text-ink-3">{t.products.margin(r.margin)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Sources({ rows }: { rows: ProfitData["sources"] }) {
  const c = t.sources.columns;
  if (rows.length === 0) return <EmptyState title={t.noData} compact />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-[13px]">
        <thead>
          <tr className="text-xs text-ink-3">
            <th className="pb-2 text-start font-medium">{c.source}</th>
            <th className="pb-2 text-end font-medium">{c.orders}</th>
            <th className="pb-2 text-end font-medium">{c.revenue}</th>
            <th className="pb-2 text-end font-medium">{c.spend}</th>
            <th className="pb-2 text-end font-medium">{c.net}</th>
            <th className="pb-2 text-end font-medium">{c.roas}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => (
            <tr key={s.source}>
              <td className="py-2.5 font-semibold">{ar.analytics.sources.names[s.source] ?? s.source}</td>
              <td className="tabular py-2.5 text-end">{formatNumber(s.orders)}</td>
              <td className="tabular py-2.5 text-end">{formatMoney(s.revenue)}</td>
              <td className="tabular py-2.5 text-end">{s.ad_spend > 0 ? formatMoney(s.ad_spend) : "—"}</td>
              <td className={cn("tabular py-2.5 text-end font-semibold", s.net < 0 && "text-danger")}>{formatMoney(s.net)}</td>
              <td className="tabular py-2.5 text-end">{s.roas === null ? "—" : `${s.roas}x`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpensesPanel({ from, to, canEdit }: { from: string; to: string; canEdit: boolean }) {
  const e = t.expenses;
  const [page, setPage] = React.useState(1);
  const [drawer, setDrawer] = React.useState<ExpenseDrawerState>(null);
  const [deleting, setDeleting] = React.useState<Expense | null>(null);
  const [busy, setBusy] = React.useState(false);
  const query = useExpenses(from, to, page);
  const refresh = useRefreshProfit();
  const rows = query.data?.data ?? [];

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteExpense(deleting.id);
      toast.success(e.deleted);
      setDeleting(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={e.title}
        description={e.hint}
        actions={
          canEdit ? (
            <Button type="button" size="sm" onClick={() => setDrawer({ mode: "create" })}>
              <Plus aria-hidden /> {e.add}
            </Button>
          ) : null
        }
      />
      <PanelBody>
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : query.isPending ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <EmptyState title={e.empty} description={e.emptyHint} compact />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className="tabular w-24 text-xs text-ink-3">{pretty(x.spent_on)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{x.kind_label}</span>
                    {x.note ? <span className="block truncate text-xs text-ink-3">{x.note}</span> : null}
                  </span>
                  <span className="tabular font-semibold">{formatMoney(x.amount)}</span>
                  {canEdit ? (
                    <span className="flex gap-1">
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={e.edit} onClick={() => setDrawer({ mode: "edit", expense: x })}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={e.delete} onClick={() => setDeleting(x)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {query.data && query.data.meta.last_page > 1 ? <Pagination page={page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={setPage} /> : null}
          </div>
        )}
      </PanelBody>
      <ExpenseDrawer state={drawer} onClose={() => setDrawer(null)} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title={e.deleteTitle} description={e.deleteText} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void confirmDelete()} />
    </Panel>
  );
}

function PackagingPanel() {
  const settings = useProfitSettings();
  if (settings.isPending) return <Skeleton className="h-28" />;
  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} message={errorMessage(settings.error)} />;
  return <PackagingForm key={settings.data.packaging_cost} initial={String(settings.data.packaging_cost)} />;
}

function PackagingForm({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const refresh = useRefreshProfit();
  const valid = /^\d{1,6}(\.\d{1,2})?$/.test(value);

  async function save() {
    setBusy(true);
    try {
      await savePackaging(value);
      toast.success(t.packaging.saved);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title={t.packaging.title} description={t.packaging.hint} />
      <PanelBody>
        <div className="flex flex-wrap items-center gap-2">
          <MoneyInput aria-label={t.packaging.title} value={value} onChange={setValue} aria-invalid={!valid} className="sm:w-48" />
          <Button type="button" loading={busy} disabled={!valid || value === initial} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}
