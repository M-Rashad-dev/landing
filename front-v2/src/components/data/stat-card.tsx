import { ArrowDownLeft, ArrowUpLeft, Minus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Skeleton } from "@/components/ui/feedback";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * A number with its change against the previous period.
 * `inverse`: a drop is good (cancellations, returns) so it shows green.
 * `attention`: yellow mark for "needs you now" numbers (orders waiting).
 */
export function StatCard({
  label,
  value,
  change,
  inverse = false,
  hint,
  href,
  attention = false,
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  change?: number | null;
  inverse?: boolean;
  hint?: React.ReactNode;
  href?: string;
  attention?: boolean;
  loading?: boolean;
}) {
  const body = (
    <div className={cn("flex h-full flex-col gap-2 rounded-xl border bg-surface p-4", attention ? "border-accent/60 bg-accent-soft/50" : "border-border", href && "transition-colors hover:border-border-strong")}>
      <p className="flex items-center gap-2 text-[13px] text-ink-2">
        {attention ? <span className="size-2 rounded-full bg-accent" aria-hidden /> : null}
        {label}
      </p>
      {loading ? <Skeleton className="h-8 w-24" /> : <p className="tabular font-display text-[26px] font-semibold leading-none">{value}</p>}
      {loading ? <Skeleton className="h-4 w-32" /> : <Delta change={change} inverse={inverse} hint={hint} />}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function Delta({ change, inverse, hint }: { change?: number | null; inverse: boolean; hint?: React.ReactNode }) {
  if (change === undefined) return hint ? <p className="text-xs text-ink-3">{hint}</p> : null;
  if (change === null) return <p className="text-xs text-ink-3">{ar.common.noComparison}</p>;
  const good = change === 0 ? null : inverse ? change < 0 : change > 0;
  const Icon = change === 0 ? Minus : change > 0 ? ArrowUpLeft : ArrowDownLeft;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
      <span className={cn("tabular inline-flex items-center gap-0.5 rounded px-1 font-semibold", good === null ? "bg-surface-2 text-ink-2" : good ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} dir="ltr">
        <Icon className="size-3" aria-hidden />
        {formatPercent(change, { signed: true })}
      </span>
      {ar.common.vsPrevious}
      {hint ? <span className="w-full">{hint}</span> : null}
    </p>
  );
}

/** Usage of a plan limit: "5 of 20 products". Turns yellow from 80%, red when full. */
export function Meter({ used, limit, label, className }: { used: number; limit: number | null; label?: React.ReactNode; className?: string }) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const color = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-accent" : "bg-ink";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabular text-ink-3" dir="ltr">
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${unlimited ? 0 : Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}
