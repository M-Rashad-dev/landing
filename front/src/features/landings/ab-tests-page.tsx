"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Plus, Trash2, Trophy } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { api, apiPage } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { LandingRow } from "./api";

const t = ar.growth.ab;

type Side = { views: number; form_starts: number; orders: number; revenue: number; conversion: number | null };
type TestPage = { id: number; title: string; slug: string; published: boolean };
export type AbTest = {
  id: number;
  locked_by_plan: boolean;
  name: string;
  status: "running" | "finished";
  split_a: number;
  page_a: TestPage | null;
  page_b: TestPage | null;
  winner_page_id: number | null;
  started_at: string;
  ended_at: string | null;
  results: { a: Side; b: Side; verdict: { state: "collecting" | "too_close" | "winner"; leader: "a" | "b" | null; confidence: number; lift: number | null } };
};

const KEY = ["ab-tests"] as const;

/** «اختبارات A/B»: two landing pages share page A's link; we count which one sells more. */
export function AbTestsPage() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<AbTest[]>("/dashboard/ab-tests") });
  const [creating, setCreating] = React.useState(false);

  const add = (
    <Button onClick={() => setCreating(true)}>
      <Plus />
      {t.add}
    </Button>
  );

  return (
    <>
      <PageHeader title={t.title} description={t.description} crumbs={[{ label: ar.nav.items.landings, href: "/dashboard/marketing/landings" }, { label: t.title }]} actions={add} />
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t.empty} description={t.emptyText} action={add} />
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.map((test) => (
            <li key={test.id}>
              <TestCard test={test} />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="md">{creating ? <CreateForm onClose={() => setCreating(false)} /> : null}</DialogContent>
      </Dialog>
    </>
  );
}

function TestCard({ test }: { test: AbTest }) {
  const client = useQueryClient();
  const [finishing, setFinishing] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const { a, b, verdict } = test.results;
  const running = test.status === "running";
  const title = (side: "a" | "b") => (side === "a" ? test.page_a?.title : test.page_b?.title) ?? "—";

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setFinishing(false);
      setRemoving(false);
      await client.invalidateQueries({ queryKey: KEY });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const finish = (winner: number | null) => run(() => api(`/dashboard/ab-tests/${test.id}/finish`, { method: "POST", body: { winner_page_id: winner } }), winner !== null && winner === test.page_b?.id ? t.winnerB : t.finished_);

  const verdictText = verdict.state === "winner" && verdict.leader ? t.verdict.winner(title(verdict.leader), verdict.confidence) : verdict.state === "too_close" ? t.verdict.too_close : t.verdict.collecting;
  const winnerSide = test.winner_page_id === null ? null : test.winner_page_id === test.page_b?.id ? "b" : "a";

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {test.name}
            <Badge size="sm" tone={running ? "success" : "neutral"} dot>
              {running ? t.running : t.finished}
            </Badge>
          </p>
          <p className="text-xs text-ink-3">
            {t.splitValue(test.split_a)} · {t.started(formatDateTime(test.started_at))}
            {test.ended_at ? ` · ${t.ended(formatDateTime(test.ended_at))}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <Button size="sm" variant="outline" onClick={() => setFinishing(true)}>
              <Trophy />
              {t.finish}
            </Button>
          ) : null}
          <Button size="icon-sm" variant="ghost" onClick={() => setRemoving(true)} aria-label={`${t.remove}: ${test.name}`}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-96 text-sm">
          <thead className="text-xs text-ink-3">
            <tr>
              <th className="pb-2 text-start font-medium" />
              <th className="pb-2 text-start font-medium">{t.columns.views}</th>
              <th className="pb-2 text-start font-medium">{t.columns.orders}</th>
              <th className="pb-2 text-start font-medium">{t.columns.conversion}</th>
              <th className="pb-2 text-start font-medium">{t.columns.revenue}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(["a", "b"] as const).map((side) => {
              const row = side === "a" ? a : b;
              const lead = verdict.leader === side && verdict.state !== "collecting";
              return (
                <tr key={side} className={cn(winnerSide === side && "bg-success/5")}>
                  <td className="py-2.5 pe-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold", side === "a" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>{side.toUpperCase()}</span>
                      <span className="truncate">{title(side)}</span>
                      {winnerSide === side ? <Trophy className="size-4 text-success" aria-label={t.finished} /> : null}
                    </span>
                  </td>
                  <td className="py-2.5 tabular">{formatNumber(row.views)}</td>
                  <td className="py-2.5 tabular">{formatNumber(row.orders)}</td>
                  <td className={cn("py-2.5 tabular", lead && "font-bold text-success")}>
                    {formatPercent(row.conversion)}
                    {lead && verdict.lift !== null ? <span className="ms-1 text-xs">({t.lift(verdict.lift)})</span> : null}
                  </td>
                  <td className="py-2.5 tabular">{formatMoney(row.revenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {running ? <p className={cn("rounded-lg px-3 py-2 text-sm", verdict.state === "winner" ? "bg-success/10 font-semibold text-success" : "bg-surface-2 text-ink-2")}>{verdictText}</p> : null}

      <Dialog open={finishing} onOpenChange={setFinishing}>
        <DialogContent size="sm">
          <DialogHeader title={t.finishTitle} description={t.finishText} />
          <DialogFooter>
            <Button variant="outline" loading={busy} onClick={() => void finish(test.page_a?.id ?? null)}>
              {t.keepA}
            </Button>
            <Button loading={busy} onClick={() => void finish(test.page_b?.id ?? null)}>
              {t.keepB}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={removing} onOpenChange={setRemoving} title={`${t.remove} «${test.name}»؟`} confirmLabel={t.remove} destructive loading={busy} onConfirm={() => void run(() => api(`/dashboard/ab-tests/${test.id}`, { method: "DELETE" }), t.removed)} />
    </article>
  );
}

const schema = z
  .object({
    name: z.string().trim().min(1, t.nameRequired).max(80),
    page_a_id: z.string().min(1, t.pageRequired),
    page_b_id: z.string().min(1, t.pageRequired),
    split_a: z.string(),
  })
  .refine((v) => v.page_a_id !== v.page_b_id, { path: ["page_b_id"], message: t.pageRequired });
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "page_a_id", "page_b_id", "split_a"] as const;
const SPLITS = [50, 60, 70, 80, 90, 40, 30, 20, 10];

function CreateForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const pages = useQuery({
    queryKey: ["landings", "published-choices"],
    queryFn: async () => (await apiPage<LandingRow>("/dashboard/pages", { query: { status: "published", per_page: 100 } })).data,
  });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", page_a_id: "", page_b_id: "", split_a: "50" } });
  const { errors, isSubmitting } = form.formState;
  const options = (pages.data ?? []).map((p) => ({ value: String(p.id), label: p.title, hint: `/${p.slug}` }));

  const submit = form.handleSubmit(async (v) => {
    try {
      await api("/dashboard/ab-tests", { method: "POST", body: { name: v.name, page_a_id: Number(v.page_a_id), page_b_id: Number(v.page_b_id), split_a: Number(v.split_a) } });
      toast.success(t.created);
      await client.invalidateQueries({ queryKey: KEY });
      onClose();
    } catch (error) {
      if (isApiError(error)) for (const f of FIELDS) if (error.errors[f]?.[0]) form.setError(f, { message: error.errors[f][0] });
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <DialogHeader title={t.add} description={t.description} />
      <form onSubmit={submit} noValidate>
        <DialogBody className="flex flex-col gap-4">
          <Field label={t.name} htmlFor="ab-name" error={errors.name?.message} required>
            <Input id="ab-name" {...form.register("name")} />
          </Field>
          <Field label={t.pageA} htmlFor="ab-a" hint={t.pageAHint} error={errors.page_a_id?.message} required>
            <Controller control={form.control} name="page_a_id" render={({ field }) => <Select id="ab-a" value={field.value} onValueChange={field.onChange} options={options} placeholder={t.pageA} invalid={!!errors.page_a_id} />} />
          </Field>
          <Field label={t.pageB} htmlFor="ab-b" hint={t.pageBHint} error={errors.page_b_id?.message} required>
            <Controller control={form.control} name="page_b_id" render={({ field }) => <Select id="ab-b" value={field.value} onValueChange={field.onChange} options={options} placeholder={t.pageB} invalid={!!errors.page_b_id} />} />
          </Field>
          <Field label={t.split} htmlFor="ab-split" error={errors.split_a?.message}>
            <Controller control={form.control} name="split_a" render={({ field }) => <Select id="ab-split" value={field.value} onValueChange={field.onChange} options={SPLITS.map((n) => ({ value: String(n), label: t.splitValue(n) }))} />} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {t.add}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
