"use client";

import { ArrowLeft, Banknote, CalendarDays, CalendarRange, Clock, FileText, ShoppingBag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCairo } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { useOverview, type Overview } from "@/lib/orders/api";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.overview;

export function HomeOverview() {
  const { data, isPending, isError, error, refetch } = useOverview();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <OverviewSkeleton />;

  if (data.total_orders === 0 && data.pages_count === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t.startTitle}
        description={t.startText}
        action={
          <Button asChild>
            <Link href="/dashboard/pages/new">{t.createPage}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Clock} label={t.today} value={formatNumber(data.orders_today)} />
        <Stat icon={CalendarDays} label={t.week} value={formatNumber(data.orders_week)} />
        <Stat icon={CalendarRange} label={t.month} value={formatNumber(data.orders_month)} />
        <Stat icon={Banknote} label={t.revenue} value={formatPrice(data.revenue_delivered)} />
        <Link href="/dashboard/orders?status=new" className="col-span-2 lg:col-span-1">
          <Stat icon={ShoppingBag} label={t.newOrders} value={formatNumber(data.counts.new)} highlight={data.counts.new > 0} />
        </Link>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 font-bold">{t.chart}</h2>
        <OrdersChart chart={data.chart} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t.latest}</h2>
            <Button variant="link" size="sm" asChild>
              <Link href="/dashboard/orders">
                {t.allOrders}
                <ArrowLeft />
              </Link>
            </Button>
          </div>
          {data.latest_orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.noOrders}</p>
          ) : (
            <ul className="divide-y">
              {data.latest_orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/dashboard/orders/${order.id}`} className="flex items-center gap-3 py-3 hover:bg-accent/50">
                    <span className="w-14 font-bold tabular-nums">#{order.order_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{order.customer_name}</span>
                      <span className="block text-xs text-muted-foreground">{formatCairo(order.created_at)}</span>
                    </span>
                    <span className="hidden text-sm font-semibold sm:block">{formatPrice(order.total)}</span>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-bold">{t.topPages}</h2>
          {data.top_pages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.noOrders}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.top_pages.map((page, index) => {
                const max = data.top_pages[0]?.orders || 1;
                return (
                  <li key={page.id}>
                    <Link href={`/dashboard/orders?page_id=${page.id}`} className="block">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-semibold">
                          {index + 1}. {page.title ?? "—"}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{t.ordersCount(page.orders)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (page.orders / max) * 100)}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight = false }: { icon: typeof Clock; label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn("flex h-full flex-col gap-3 p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md", highlight && "border-gold/50 bg-gold-soft")}>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", highlight ? "bg-gold text-gold-foreground" : "bg-secondary text-primary")}>
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </span>
      <span className={cn("font-display text-2xl font-semibold tabular-nums", highlight && "text-gold-foreground")}>{value}</span>
    </Card>
  );
}

/** 14 bars in plain CSS (no chart library). Today's bar is gold. */
function OrdersChart({ chart }: { chart: Overview["chart"] }) {
  const max = Math.max(1, ...chart.map((d) => d.count));
  const dayLabel = (date: string) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const last = chart.length - 1;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-5 bottom-6 flex flex-col justify-between" aria-hidden>
        {[0, 1, 2, 3].map((line) => (
          <span key={line} className="border-t border-dashed border-border" />
        ))}
      </div>
      <div className="relative flex h-52 items-end gap-1.5 sm:gap-2.5" role="img" aria-label={chart.map((d) => `${dayLabel(d.date)}: ${d.count}`).join("، ")}>
        {chart.map((day, index) => (
          <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100">{day.count > 0 ? formatNumber(day.count) : ""}</span>
            <div
              className={cn(
                "bar-grow w-full max-w-10 rounded-t-lg transition-[filter] group-hover:brightness-110",
                day.count === 0 ? "bg-muted" : index === last ? "bg-gradient-to-t from-gold to-gold/70" : "bg-gradient-to-t from-primary to-primary/60",
              )}
              style={{ height: `${day.count > 0 ? Math.max(6, (day.count / max) * 100) : 3}%`, animationDelay: `${index * 30}ms` }}
              title={`${dayLabel(day.date)}: ${day.count}`}
            />
            <span className={cn("truncate text-[10px] text-muted-foreground", index % 2 === 1 && "max-sm:invisible", index === last && "font-semibold text-foreground")}>{dayLabel(day.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
