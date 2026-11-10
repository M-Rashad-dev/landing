"use client";

import { Building2, CalendarClock, CalendarPlus, CheckCircle2, CircleOff, Crown, FileCheck2, Hourglass, PauseCircle, ShoppingBag, Sigma, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ErrorState } from "@/components/dashboard/error-state";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOverview } from "@/lib/admin/api";
import { formatNumber } from "@/lib/format/number";
import { ar } from "@/messages/ar";

const t = ar.admin.overview;

export function AdminOverviewCards() {
  const { data, isPending, isError, error, refetch } = useAdminOverview();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards: { icon: LucideIcon; label: string; value: number; href?: string }[] = [
    { icon: Building2, label: t.tenants, value: data.tenants, href: "/admin/tenants" },
    { icon: CheckCircle2, label: t.active, value: data.active_tenants, href: "/admin/tenants?status=active" },
    { icon: PauseCircle, label: t.suspended, value: data.suspended_tenants, href: "/admin/tenants?status=suspended" },
    { icon: CalendarPlus, label: t.newWeek, value: data.new_tenants_week },
    { icon: FileCheck2, label: t.published, value: data.published_pages },
    { icon: ShoppingBag, label: t.ordersToday, value: data.orders_today },
    { icon: Sigma, label: t.ordersTotal, value: data.orders_total },
    { icon: Hourglass, label: t.trials, value: data.trials },
    { icon: CalendarClock, label: t.expiringWeek, value: data.expiring_week },
    { icon: CircleOff, label: t.expired, value: data.expired },
    ...Object.entries(data.plans).map(([key, value]) => ({ icon: Crown, label: t.onPlan(key), value, href: "/admin/plans" })),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, href }) => {
        const body = (
          <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-primary/40">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-4" aria-hidden />
              {label}
            </span>
            <span className="text-2xl font-extrabold tabular-nums">{formatNumber(value)}</span>
          </Card>
        );
        return href ? (
          <Link key={label} href={href}>
            {body}
          </Link>
        ) : (
          <div key={label}>{body}</div>
        );
      })}
    </div>
  );
}
