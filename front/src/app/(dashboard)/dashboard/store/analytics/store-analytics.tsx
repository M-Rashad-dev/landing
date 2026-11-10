"use client";

import { Banknote, BarChart3, Eye, MousePointerClick, Percent, ShoppingBag, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { StatCard } from "@/components/analytics/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cairoToday } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { formatPrice } from "@/lib/price";
import { useStoreAnalytics, type StoreAnalytics } from "@/lib/store/api";
import { ar } from "@/messages/ar";

const t = ar.store.analytics;
const RANGES = { d7: 7, d30: 30, d90: 90 } as const;
type Range = keyof typeof RANGES;

function minusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const percent = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`);

export function StoreAnalyticsDashboard() {
  const [range, setRange] = useState<Range>("d30");
  const to = cairoToday();
  const { data, isPending, isError, error, refetch } = useStoreAnalytics(minusDays(to, RANGES[range] - 1), to);

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
        <TabsList>
          {(Object.keys(RANGES) as Range[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {t.range[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending || !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <Report data={data} />
      )}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
      <div className="bar-grow-x h-full rounded-full bg-gradient-to-l from-primary to-primary/60" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </div>
  );
}

function Report({ data }: { data: StoreAnalytics }) {
  const { totals } = data;
  if (totals.views === 0 && totals.orders === 0) {
    return <EmptyState icon={BarChart3} title={t.empty} description={t.description} />;
  }
  const funnel = [
    { label: t.views, value: totals.views },
    { label: t.productViews, value: totals.product_views },
    { label: t.addToCart, value: totals.add_to_cart },
    { label: t.checkouts, value: totals.checkouts },
    { label: t.orders, value: totals.orders },
  ];
  const top = Math.max(1, ...funnel.map((f) => f.value));
  const maxDay = Math.max(1, ...data.days.map((d) => d.views));
  const label = (date: string) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const maxSource = Math.max(1, ...data.sources.map((s) => s.views));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard icon={Eye} label={t.views} value={formatNumber(totals.views)} />
        <StatCard icon={MousePointerClick} label={t.productViews} value={formatNumber(totals.product_views)} />
        <StatCard icon={ShoppingCart} label={t.addToCart} value={formatNumber(totals.add_to_cart)} />
        <StatCard icon={ShoppingBag} label={t.orders} value={formatNumber(totals.orders)} />
        <StatCard icon={Percent} label={t.conversion} value={percent(totals.conversion)} highlight />
        <StatCard icon={Banknote} label={t.revenue} value={formatPrice(totals.revenue)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-bold">{t.funnel}</h2>
          <ul className="flex flex-col gap-3">
            {funnel.map((step) => (
              <li key={step.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="tabular-nums text-muted-foreground">{formatNumber(step.value)}</span>
                </div>
                <Bar value={step.value} max={top} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-base font-bold">{t.sources}</h2>
          <ul className="flex flex-col gap-3">
            {data.sources.map((s) => (
              <li key={s.source} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{ar.analytics.source[s.source] ?? s.source}</span>
                  <span className="tabular-nums text-muted-foreground">{formatNumber(s.views)}</span>
                </div>
                <Bar value={s.views} max={maxSource} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-bold">{t.daily}</h2>
        <div className="flex h-48 items-end gap-[2px] sm:gap-1" role="img" aria-label={data.days.map((d) => `${label(d.date)}: ${d.views} ${t.views}، ${d.orders} ${t.orders}`).join("؛ ")}>
          {data.days.map((day) => (
            <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${label(day.date)} — ${day.views} ${t.views} · ${day.orders} ${t.orders} · ${formatPrice(day.revenue)}`}>
              <div className="bar-grow w-full rounded-t-md bg-gradient-to-t from-primary/80 to-primary/40" style={{ height: `${day.views > 0 ? Math.max(4, (day.views / maxDay) * 100) : 2}%` }} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-bold">{t.topProducts}</h2>
        {data.top_products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="divide-y">
            {data.top_products.map((p) => (
              <li key={`${p.product_id}-${p.name}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatNumber(p.units)} {t.units} · {formatPrice(p.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
