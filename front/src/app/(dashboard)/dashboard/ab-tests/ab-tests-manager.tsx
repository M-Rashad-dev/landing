"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, Crown, FlaskConical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { useSession, useSiteUrl } from "@/components/dashboard/session-context";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { analyticsKeys, createAbTest, deleteAbTest, finishAbTest, useAbTests, type AbTest, type Totals } from "@/lib/analytics/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { usePages, type PageSummary } from "@/lib/pages/api";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.abTests;
const a = ar.analytics;

export function AbTestsManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useAbTests();
  const [creating, setCreating] = useState(false);
  const [finishing, setFinishing] = useState<AbTest | null>(null);
  const [removing, setRemoving] = useState<AbTest | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: analyticsKeys.tests });

  async function finish(test: AbTest, winner: number | null) {
    setBusy(true);
    try {
      await finishAbTest(test.id, winner);
      toast.success(t.finishedToast);
      setFinishing(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteAbTest(removing.id);
      toast.success(t.removed);
      setRemoving(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          {t.create}
        </Button>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t.emptyTitle} description={t.emptyText} action={<Button onClick={() => setCreating(true)}>{t.create}</Button>} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.map((test) => (
            <TestCard key={test.id} test={test} onFinish={() => setFinishing(test)} onRemove={() => setRemoving(test)} />
          ))}
        </div>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} onCreated={refresh} />

      <Dialog open={finishing !== null} onOpenChange={(open) => !open && setFinishing(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t.finishTitle}</DialogTitle>
            <DialogDescription>{t.finishText}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2">
            {finishing
              ? (["a", "b"] as const).map((key) => {
                  const page = key === "a" ? finishing.page_a : finishing.page_b;
                  if (!page) return null;
                  const leader = finishing.results.verdict.leader === key;
                  return (
                    <Button key={key} variant={leader ? "default" : "outline"} className="justify-between" loading={busy} onClick={() => finish(finishing, page.id)}>
                      <span>
                        {t.keep(key.toUpperCase())} — {page.title}
                      </span>
                      {leader ? <Crown aria-hidden /> : null}
                    </Button>
                  );
                })
              : null}
            <Button variant="ghost" disabled={busy} onClick={() => finishing && finish(finishing, null)}>
              {t.noWinner}
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)} title={removing ? t.removeConfirm(removing.name) : ""} confirmLabel={t.remove} loading={busy} onConfirm={remove} />
    </div>
  );
}

function TestCard({ test, onFinish, onRemove }: { test: AbTest; onFinish: () => void; onRemove: () => void }) {
  const session = useSession();
  const siteUrl = useSiteUrl();
  const link = test.page_a ? siteUrl(session.primary_host, `/${test.page_a.slug}`) : "";
  const { verdict } = test.results;
  const running = test.status === "running";
  const winnerKey = test.winner_page_id === test.page_a?.id ? "a" : test.winner_page_id === test.page_b?.id ? "b" : null;

  const verdictText =
    verdict.state === "collecting"
      ? t.verdict.collecting
      : verdict.leader === null
        ? t.verdict.even
        : verdict.state === "winner"
          ? t.verdict.winner(verdict.leader.toUpperCase(), String(verdict.lift ?? 0))
          : t.verdict.too_close(verdict.leader.toUpperCase(), verdict.confidence);

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold">{test.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.since(formatCairo(test.started_at, { withTime: false }))}
            {running ? ` · ${t.splitValue(test.split_a)}` : ""}
          </p>
        </div>
        <Badge variant={running ? "success" : "secondary"}>{running ? t.running : t.finished}</Badge>
      </div>

      {link ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="shrink-0 text-xs text-muted-foreground">{t.link}</span>
          <span dir="ltr" className="min-w-0 flex-1 truncate text-start font-medium">
            {link}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={ar.common.copy}
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast.success(ar.common.copied);
            }}
          >
            <Copy />
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Variant label="A" title={test.page_a?.title ?? "—"} totals={test.results.a} lead={verdict.leader === "a"} winner={winnerKey === "a"} />
        <Variant label="B" title={test.page_b?.title ?? "—"} totals={test.results.b} lead={verdict.leader === "b"} winner={winnerKey === "b"} />
      </div>

      <p className={cn("rounded-lg px-3 py-2 text-sm", verdict.state === "winner" ? "bg-success/10 font-semibold text-success" : "bg-gold-soft text-gold-foreground")}>{verdictText}</p>
      {!running && winnerKey === "b" ? <p className="text-xs text-muted-foreground">{t.routedToB}</p> : null}

      <div className="mt-auto flex items-center justify-end gap-2">
        {running ? (
          <Button size="sm" onClick={onFinish}>
            <Crown />
            {t.finish}
          </Button>
        ) : null}
        <Button size="icon-sm" variant="ghost" aria-label={t.remove} title={t.remove} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
    </Card>
  );
}

function Variant({ label, title, totals, lead, winner }: { label: string; title: string; totals: Totals; lead: boolean; winner: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-xl border p-3 transition-colors", (lead || winner) && "border-gold/60 bg-gold-soft/60")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold", lead || winner ? "bg-gold text-gold-foreground" : "bg-secondary text-primary")}>{label}</span>
        <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
        {winner ? <Crown className="ms-auto size-4 shrink-0 text-gold" aria-label={t.winnerLabel} /> : null}
      </div>
      <p className="font-display text-3xl font-semibold tabular-nums">{totals.conversion === null ? "—" : `${totals.conversion.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`}</p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{a.views}</dt>
        <dd className="text-end tabular-nums">{formatNumber(totals.views)}</dd>
        <dt className="text-muted-foreground">{a.orders}</dt>
        <dd className="text-end tabular-nums">{formatNumber(totals.orders)}</dd>
        <dt className="text-muted-foreground">{a.revenue}</dt>
        <dd className="text-end tabular-nums">{formatPrice(totals.revenue)}</dd>
      </dl>
    </div>
  );
}

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<unknown> }) {
  const pages = usePages({ status: "published" });
  const [name, setName] = useState("");
  const [pageA, setPageA] = useState("");
  const [pageB, setPageB] = useState("");
  const [split, setSplit] = useState(50);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const list: PageSummary[] = pages.data?.data ?? [];
  const first = list.find((p) => String(p.id) === pageA);
  const candidates = list.filter((p) => String(p.id) !== pageA && (!first || p.product_id === first.product_id));
  const option = (p: PageSummary) => ({ value: String(p.id), label: p.product?.name ? `${p.title} — ${p.product.name}` : p.title });

  async function submit() {
    setSaving(true);
    setErrors({});
    try {
      await createAbTest({ name: name.trim(), page_a_id: Number(pageA), page_b_id: Number(pageB), split_a: split });
      toast.success(t.created);
      setName("");
      setPageA("");
      setPageB("");
      setSplit(50);
      await onCreated();
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0] ?? ""])));
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.create}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {list.filter((p) => p.product_id).length < 2 ? <p className="rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold-foreground">{t.needPages}</p> : null}
          <FormField label={t.name} htmlFor="ab-name" error={errors.name} required>
            <Input id="ab-name" value={name} maxLength={80} placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={t.pageA} htmlFor="ab-a" error={errors.page_a_id} required>
            <Select
              id="ab-a"
              value={pageA}
              placeholder={t.choosePage}
              onChange={(e) => {
                setPageA(e.target.value);
                setPageB("");
              }}
              options={list.filter((p) => p.product_id).map(option)}
            />
          </FormField>
          <FormField label={t.pageB} htmlFor="ab-b" error={errors.page_b_id} hint={t.pageBHint} required>
            <Select id="ab-b" value={pageB} placeholder={t.choosePage} onChange={(e) => setPageB(e.target.value)} options={candidates.map(option)} />
          </FormField>
          <FormField label={t.split} htmlFor="ab-split" error={errors.split_a}>
            <div className="flex items-center gap-3">
              <input id="ab-split" type="range" min={10} max={90} step={5} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
              <span className="w-32 text-end text-sm font-medium tabular-nums">{t.splitValue(split)}</span>
            </div>
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || !pageA || !pageB}>
            {t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
