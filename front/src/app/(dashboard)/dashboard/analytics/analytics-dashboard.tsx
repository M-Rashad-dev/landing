"use client";

import { Banknote, BarChart3, Eye, MousePointerClick, Percent, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/analytics/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalytics, type AnalyticsReport } from "@/lib/analytics/api";
import { cairoToday } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { usePages } from "@/lib/pages/api";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.analytics;
const RANGES = ["7", "30", "90"] as const;

/** YYYY-MM-DD minus n days (calendar math in UTC, no time zone drift). */
function minusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const percent = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`);

export function AnalyticsDashboard() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30");
  const [pageId, setPageId] = useState("");
  const to = cairoToday();
  const { data, isPending, isError, error, refetch } = useAnalytics({ from: minusDays(to, Number(range) - 1), to, page_id: pageId });
  const pages = usePages({ status: "published" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={range} onValueChange={(value) => setRange(value as (typeof RANGES)[number])}>
          <TabsList>
            {RANGES.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t.ranges[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="w-full sm:w-64">
          <Select aria-label={t.page} value={pageId} onChange={(e) => setPageId(e.target.value)} options={[{ value: "", label: t.allPages }, ...(pages.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.title }))]} />
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending || !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <Report data={data} showPages={!pageId} />
      )}
    </div>
  );
}

function Report({ data, showPages }: { data: AnalyticsReport; showPages: boolean }) {
  const { totals } = data;
  const empty = totals.views === 0 && totals.orders === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Eye} label={t.views} value={formatNumber(totals.views)} />
        <StatCard icon={MousePointerClick} label={t.formStarts} value={formatNumber(totals.form_starts)} />
        <StatCard icon={ShoppingBag} label={t.orders} value={formatNumber(totals.orders)} />
        <StatCard icon={Percent} label={t.conversion} value={percent(totals.conversion)} highlight />
        <StatCard icon={Banknote} label={t.revenue} value={formatPrice(totals.revenue)} />
      </div>

      {empty ? (
        <EmptyState icon={BarChart3} title={t.emptyTitle} description={t.emptyText} />
      ) : (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">{t.daily}</h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-primary/70" aria-hidden />
                  {t.legendViews}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-gold" aria-hidden />
                  {t.legendOrders}
                </span>
              </div>
            </div>
            <DailyChart daily={data.daily} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card className="p-5">
              <h2 className="mb-4 text-base font-bold">{t.sources}</h2>
              <Sources sources={data.sources} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 text-base font-bold">{t.devices}</h2>
              <Devices devices={data.devices} />
            </Card>
          </div>

          {showPages ? <PagesTable pages={data.pages} /> : null}
        </>
      )}
    </div>
  );
}

/** Views as bars, orders as gold dots on their own scale; plain CSS. */
function DailyChart({ daily }: { daily: AnalyticsReport["daily"] }) {
  const maxViews = Math.max(1, ...daily.map((d) => d.views));
  const maxOrders = Math.max(1, ...daily.map((d) => d.orders));
  const label = (date: string) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const every = Math.ceil(daily.length / 10);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
        {[0, 1, 2, 3].map((line) => (
          <span key={line} className="border-t border-dashed border-border" />
        ))}
      </div>
      <div className="relative flex h-56 items-end gap-[2px] sm:gap-1" role="img" aria-label={daily.map((d) => `${label(d.date)}: ${d.views} ${t.legendViews}، ${d.orders} ${t.legendOrders}`).join("؛ ")}>
        {daily.map((day, i) => (
          <div key={day.date} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${label(day.date)} — ${day.views} ${t.legendViews} · ${day.orders} ${t.legendOrders}`}>
            <div className="relative flex w-full flex-1 items-end justify-center pb-6">
              <div
                className={cn("bar-grow w-full max-w-7 rounded-t-md bg-gradient-to-t from-primary/80 to-primary/40 transition-[filter] group-hover:brightness-110", day.views === 0 && "bg-none bg-muted")}
                style={{ height: `${day.views > 0 ? Math.max(4, (day.views / maxViews) * 100) : 2}%`, animationDelay: `${i * 12}ms` }}
              />
              {day.orders > 0 ? <span className="absolute size-2.5 rounded-full bg-gold ring-2 ring-card" style={{ bottom: `calc(${(day.orders / maxOrders) * 100}% * 0.85 + 1.5rem)` }} /> : null}
            </div>
            <span className={cn("absolute bottom-0 truncate text-[10px] text-muted-foreground", i % every !== 0 && "invisible")}>{label(day.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: AnalyticsReport["sources"] }) {
  const max = Math.max(1, ...sources.map((s) => s.views));
  return (
    <ul className="flex flex-col gap-3">
      {sources.map((s) => (
        <li key={s.source} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{t.source[s.source] ?? s.source}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatNumber(s.views)} · {t.ordersShort(s.orders)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="bar-grow-x h-full rounded-full bg-gradient-to-l from-primary to-primary/60" style={{ width: `${Math.max(2, (s.views / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Devices({ devices }: { devices: AnalyticsReport["devices"] }) {
  const total = devices.mobile + devices.desktop;
  const mobile = total > 0 ? Math.round((devices.mobile / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${mobile}%` }} />
        <div className="h-full bg-gold" style={{ width: `${total > 0 ? 100 - mobile : 0}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-secondary p-3">
          <dt className="text-xs text-muted-foreground">{t.mobile}</dt>
          <dd className="font-display text-xl font-semibold tabular-nums">{mobile}%</dd>
        </div>
        <div className="rounded-xl bg-gold-soft p-3">
          <dt className="text-xs text-muted-foreground">{t.desktop}</dt>
          <dd className="font-display text-xl font-semibold tabular-nums">{total > 0 ? 100 - mobile : 0}%</dd>
        </div>
      </dl>
    </div>
  );
}

type PageRow = AnalyticsReport["pages"][number];

function PagesTable({ pages }: { pages: AnalyticsReport["pages"] }) {
  const best = Math.max(0, ...pages.map((p) => p.conversion ?? 0));
  const columns: Column<PageRow>[] = [
    {
      key: "title",
      header: t.page,
      cell: (p) =>
        p.deleted ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            {p.title} <Badge variant="secondary">{t.deleted}</Badge>
          </span>
        ) : (
          <Link href={`/dashboard/pages/${p.id}`} className="font-semibold hover:text-primary">
            {p.title}
          </Link>
        ),
    },
    { key: "views", header: t.views, cell: (p) => <span className="tabular-nums">{formatNumber(p.views)}</span> },
    { key: "starts", header: t.formStarts, cell: (p) => <span className="tabular-nums">{formatNumber(p.form_starts)}</span> },
    { key: "orders", header: t.orders, cell: (p) => <span className="font-semibold tabular-nums">{formatNumber(p.orders)}</span> },
    {
      key: "conversion",
      header: t.conversion,
      cell: (p) => (
        <span className={cn("inline-flex items-center gap-1.5 tabular-nums", p.conversion === best && best > 0 && "font-bold text-success")}>
          {percent(p.conversion)}
        </span>
      ),
    },
    { key: "revenue", header: t.revenue, cell: (p) => <span className="tabular-nums">{formatPrice(p.revenue)}</span> },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold">{t.pages}</h2>
      <DataTable columns={columns} rows={pages} rowKey={(p) => p.id} />
    </section>
  );
}
