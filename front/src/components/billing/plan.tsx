"use client";

import { Crown, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/components/dashboard/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUsage } from "@/lib/billing/api";
import { PLAN_BLOCK_EVENT } from "@/lib/billing/events";
import type { Entitlements, PlanBlock, PlanFeatureKey, PlanLimitKey } from "@/lib/billing/types";
import { formatNumber } from "@/lib/format/number";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.billing;

export const PRICING_PATH = "/dashboard/plans";
export const PLAN_PATH = "/dashboard/settings/plan";

/** The store's plan from the session (refreshed with router.refresh()). */
export function usePlan(): Entitlements | null {
  return useSession().plan;
}

/** A feature is off, or a limit is 0 (nothing allowed). */
export function isClosed(plan: Entitlements | null, gate: { feature?: PlanFeatureKey; limit?: PlanLimitKey }): boolean {
  if (!plan) return false;
  if (plan.state === "expired") return true;
  if (gate.feature) return !plan.features[gate.feature];
  if (gate.limit) return plan.limits[gate.limit].limit === 0;
  return false;
}

/** One upgrade dialog for every plan refusal the API sends (see lib/billing/events). */
export function UpgradeDialog() {
  const [block, setBlock] = useState<PlanBlock | null>(null);

  useEffect(() => {
    const onBlock = (event: Event) => setBlock((event as CustomEvent<PlanBlock>).detail);
    window.addEventListener(PLAN_BLOCK_EVENT, onBlock);
    return () => window.removeEventListener(PLAN_BLOCK_EVENT, onBlock);
  }, []);

  const title = block?.code === "plan_limit_reached" ? t.dialog.limitTitle : block?.code === "subscription_expired" ? t.dialog.expiredTitle : t.dialog.featureTitle;
  const target = block?.upgrade_to;

  return (
    <Dialog open={block !== null} onOpenChange={(open) => (!open ? setBlock(null) : undefined)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-gold" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{block?.message}</DialogDescription>
        </DialogHeader>
        {block?.code === "plan_limit_reached" && block.limit !== undefined && block.used !== undefined ? (
          <DialogBody>
            <Meter used={block.used} limit={block.limit} unlimited={false} />
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setBlock(null)}>
            {t.dialog.later}
          </Button>
          <Button variant="gold" asChild>
            <Link href={PRICING_PATH} onClick={() => setBlock(null)}>
              <Crown />
              {target ? t.dialog.upgradeTo(target.name) : block?.code === "subscription_expired" ? t.renew : t.upgrade}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trial days left, renewal reminder, grace or expired, above every dashboard screen. */
export function PlanBanner() {
  const plan = usePlan();
  if (!plan) return null;

  let tone: "info" | "warning" | "danger" | null = null;
  let text = "";
  if (plan.state === "expired") {
    tone = "danger";
    text = plan.plan ? t.banner.expired : t.banner.noPlan;
  } else if (plan.state === "grace") {
    tone = "danger";
    text = t.banner.grace;
  } else if (plan.is_trial && plan.days_left !== null) {
    tone = "info";
    text = t.banner.trial(plan.days_left);
  } else if (plan.renewal_due && plan.days_left !== null) {
    tone = "warning";
    text = t.banner.renewal(plan.days_left);
  }
  if (!tone) return null;

  return (
    <div
      role="status"
      className={cn(
        "no-print flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm sm:px-6 lg:px-8",
        tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "info" && "border-info/30 bg-info/10 text-info",
      )}
    >
      <span className="font-semibold">{text}</span>
      <Button size="sm" variant={tone === "info" ? "outline" : "gold"} asChild>
        <Link href={PRICING_PATH}>{plan.state === "active" && plan.is_trial ? t.seePlans : t.renew}</Link>
      </Button>
    </div>
  );
}

export function Meter({ used, limit, unlimited, label, className }: { used: number; limit: number; unlimited: boolean; label?: ReactNode; className?: string }) {
  const ratio = unlimited || limit <= 0 ? (limit <= 0 && !unlimited ? 1 : 0) : Math.min(1, used / limit);
  const full = !unlimited && used >= limit;

  return (
    <div className={cn("min-w-40", className)}>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        {label ? <span className="font-semibold">{label}</span> : null}
        <span className={cn("tabular-nums text-muted-foreground", full && "font-semibold text-destructive")}>{t.meter(used, unlimited ? t.unlimited : formatNumber(limit))}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full transition-[width] duration-500", full ? "bg-destructive" : ratio > 0.8 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  );
}

/** "3 of 5" for one limit, for list page headers. Hidden while loading or on error (the API still enforces). */
export function UsageMeter({ limit, className }: { limit: PlanLimitKey; className?: string }) {
  const { data } = useUsage([limit]);
  const row = data?.find((item) => item.key === limit);
  if (!row) return null;

  return (
    <Link href={PLAN_PATH} className={cn("block rounded-lg px-2 py-1 transition-colors hover:bg-accent", className)} aria-label={`${row.label}: ${t.meter(row.used, row.unlimited ? t.unlimited : String(row.limit))}`}>
      <Meter used={row.used} limit={row.limit} unlimited={row.unlimited} />
    </Link>
  );
}

export function PlanLockedBadge({ locked }: { locked: boolean | undefined }) {
  if (!locked) return null;
  return (
    <Badge variant="warning" title={t.locked.hint}>
      <Lock aria-hidden />
      {t.locked.badge}
    </Badge>
  );
}

/** Shown on a screen whose feature is not in the plan (data stays readable). */
export function FeatureLockedNotice({ label }: { label: string }) {
  return (
    <Card className="mb-6 flex flex-col gap-3 border-gold/40 bg-gold-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-gold-foreground" aria-hidden />
        <div>
          <p className="font-bold">{t.locked.featureTitle(label)}</p>
          <p className="text-sm text-muted-foreground">{t.locked.featureText}</p>
        </div>
      </div>
      <Button variant="gold" asChild>
        <Link href={PRICING_PATH}>
          <Crown />
          {t.upgrade}
        </Link>
      </Button>
    </Card>
  );
}

/**
 * Wraps a screen whose feature / limit may be closed: the notice shows above it (old data stays
 * readable), or instead of it with `replace` when the screen's own data needs the feature.
 */
export function PlanGate({ feature, limit, label, replace = false, children }: { feature?: PlanFeatureKey; limit?: PlanLimitKey; label: string; replace?: boolean; children: ReactNode }) {
  const plan = usePlan();
  const closed = isClosed(plan, { feature, limit }) && plan?.state !== "expired";
  return (
    <>
      {closed ? <FeatureLockedNotice label={label} /> : null}
      {closed && replace ? null : children}
    </>
  );
}
