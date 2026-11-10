"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Crown, History, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Meter, PRICING_PATH, usePlan } from "@/components/billing/plan";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { chooseLocks, useLockRows, useSubscriptions, useUsage } from "@/lib/billing/api";
import type { UsageRow } from "@/lib/billing/types";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.billing;

export function PlanOverview() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <CurrentPlan />
        <UsageCard />
      </div>
      <HistoryCard />
    </div>
  );
}

function CurrentPlan() {
  const plan = usePlan();
  if (!plan) return null;
  const tone = plan.state === "active" ? "success" : plan.state === "grace" ? "warning" : "destructive";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gold-soft">
            <Crown className="size-6 text-gold-foreground" aria-hidden />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{t.plan.current}</p>
            <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
              {plan.plan?.name ?? t.plan.none}
              <Badge variant={tone}>{t.state[plan.state]}</Badge>
              {plan.is_trial ? <Badge variant="info">{t.sources.trial}</Badge> : null}
              {plan.period ? <Badge variant="secondary">{t.periods[plan.period]}</Badge> : null}
            </p>
            {plan.state === "grace" && plan.grace_ends_at ? (
              <p className="text-sm text-destructive">{t.plan.graceEndsAt(formatCairo(plan.grace_ends_at))}</p>
            ) : plan.ends_at && plan.state === "active" ? (
              <p className="text-sm text-muted-foreground">{t.plan.endsAt(formatCairo(plan.ends_at, { withTime: false }))}</p>
            ) : null}
          </div>
        </div>
        <Button variant="gold" asChild>
          <Link href={PRICING_PATH}>{plan.state === "active" ? t.seePlans : t.renew}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function UsageCard() {
  const { data, isPending, isError, error, refetch } = useUsage();
  const locked = data?.filter((row) => row.locked > 0) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.plan.usage}</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isPending || !data ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {data.map((row) => (
                <Meter key={row.key} label={row.label} used={row.used} limit={row.limit} unlimited={row.unlimited} />
              ))}
            </div>
            {locked.length ? (
              <div className="mt-6 rounded-xl border border-warning/40 bg-warning/5 p-4">
                <p className="flex items-center gap-2 font-bold">
                  <Lock className="size-4 text-warning" aria-hidden />
                  {t.plan.lockedTitle}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.plan.lockedText}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {locked.map((row) => (
                    <li key={row.key} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">
                        {row.label} · <span className="font-semibold">{t.plan.lockedCount(row.locked)}</span>
                      </span>
                      <ChooseLocks row={row} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Pick which rows of one limit stay live (at most the limit); the others stay saved but stopped. */
function ChooseLocks({ row }: { row: UsageRow }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, isPending, isError, error } = useLockRows(row.key, open);
  const queryClient = useQueryClient();
  const router = useRouter();
  const current = selected ?? data?.rows.filter((r) => !r.locked).map((r) => r.id) ?? [];
  const max = data?.limit ?? row.limit;

  function toggle(id: number, on: boolean) {
    setSelected(on ? [...current, id] : current.filter((x) => x !== id));
  }

  async function save() {
    setSaving(true);
    try {
      await chooseLocks(row.key, current);
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(t.plan.chosen);
      setOpen(false);
      setSelected(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t.plan.choose}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (!saving ? (setOpen(next), setSelected(null)) : undefined)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t.plan.chooseTitle(row.label)}</DialogTitle>
            <DialogDescription>{t.plan.chooseHint(max)}</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[50dvh] overflow-y-auto">
            {isError ? (
              <ErrorState error={error} />
            ) : isPending || !data ? (
              <Skeleton className="h-32" />
            ) : (
              <ul className="flex flex-col gap-1">
                {data.rows.map((item) => {
                  const checked = current.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                        <Checkbox checked={checked} disabled={!checked && current.length >= max} onCheckedChange={(on) => toggle(item.id, on === true)} />
                        <span className="flex-1 truncate text-sm" dir="auto">
                          {item.label}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {ar.common.cancel}
            </Button>
            <Button onClick={save} loading={saving} disabled={!data || current.length > max}>
              {t.plan.chooseSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryCard() {
  const { data, isPending, isError, error, refetch } = useSubscriptions();

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{t.plan.history}</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isPending || !data ? (
          <Skeleton className="h-40" />
        ) : data.length === 0 ? (
          <EmptyState icon={History} title={t.plan.noHistory} className="py-8" />
        ) : (
          <ol className="flex flex-col gap-3">
            {data.map((row) => (
              <li key={row.id} className="rounded-xl border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {row.plan.name}
                  <Badge variant="secondary">{t.sources[row.source]}</Badge>
                  {row.status !== "active" ? <Badge variant="outline">{t.statuses[row.status]}</Badge> : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCairo(row.starts_at, { withTime: false })} ← {formatCairo(row.ends_at, { withTime: false })}
                  {row.amount_paid > 0 ? ` · ${t.plan.paid(formatPrice(row.amount_paid))}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
