"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, History, Loader2, Package, PauseCircle, Sparkles, Trash2, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Pagination } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { MultiSelect, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import {
  cancelImport,
  deleteImport,
  failuresFileUrl,
  FIELD_GROUPS,
  imagesPending,
  isActive,
  startImport,
  TEMPLATE_URL,
  uploadImport,
  useFailures,
  useImport,
  useImports,
  useRefreshImports,
  type ImportMapping,
  type ProductImport,
} from "./api";

const t = ar.imports;
const STATUS_TONE: Record<string, Tone> = { uploaded: "attention", queued: "info", processing: "info", completed: "success", failed: "danger", cancelled: "neutral" };
const SOURCES = ["shopify", "woocommerce", "salla", "zid", "easyorders", "generic"];

/** «استيراد المنتجات»: file → columns → import, with the history on the side. ?id= keeps the open import across reloads. */
export function ImportPage() {
  const [url, setUrl] = useUrlState(["id"] as const);
  const id = /^\d+$/.test(url.id) ? Number(url.id) : null;
  const history = useImports();
  const open = (next: number | null) => setUrl({ id: next === null ? null : String(next) });

  // Coming back to the page while an import runs: show it.
  const running = history.data?.find((i) => isActive(i) || imagesPending(i));
  React.useEffect(() => {
    if (id === null && running) setUrl({ id: String(running.id) });
  }, [id, running, setUrl]);

  return (
    <>
      <PageHeader title={t.title} description={t.description} crumbs={[{ label: ar.catalog.products.title, href: "/dashboard/catalog/products" }, { label: t.title }]} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">{id === null ? <UploadStep onUploaded={(i) => open(i.id)} /> : <ImportView id={id} onReset={() => open(null)} />}</div>
        <HistoryList items={history.data} loading={history.isPending} activeId={id} onOpen={open} />
      </div>
    </>
  );
}

function Steps({ current }: { current: 0 | 1 | 2 }) {
  const labels = [t.steps.file, t.steps.columns, t.steps.run];
  return (
    <ol className="mb-5 flex items-center gap-2 text-sm" aria-label={t.title}>
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-bold", i < current ? "bg-primary text-white" : i === current ? "bg-brand-soft text-brand-strong ring-2 ring-brand" : "bg-surface-2 text-ink-3")}>
            {i < current ? <CheckCircle2 className="size-4" aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-semibold text-ink" : "text-ink-3")}>{label}</span>
          {i < labels.length - 1 ? <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

/* ---------- 1. upload ---------- */

function UploadStep({ onUploaded }: { onUploaded: (i: ProductImport) => void }) {
  const refresh = useRefreshImports();
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const created = await uploadImport(file, setProgress);
      await refresh();
      onUploaded(created);
    } catch (e) {
      setError(isApiError(e) ? (e.errors.file?.[0] ?? errorMessage(e)) : errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <Steps current={0} />
      <Panel>
        <PanelBody className="flex flex-col gap-5">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void send(e.dataTransfer.files[0]);
            }}
            className={cn("flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors", over ? "border-brand bg-brand-soft/60" : error ? "border-danger/60" : "border-border-strong hover:bg-surface-2/60")}
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              {progress !== null ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-7" aria-hidden />}
            </span>
            <span className="font-display text-lg font-semibold">{progress === null ? t.upload.title : progress < 100 ? t.upload.uploading(progress) : t.upload.reading}</span>
            <span className="text-sm text-ink-3">{t.upload.hint}</span>
            {progress !== null ? (
              <span className="h-1.5 w-56 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </span>
            ) : (
              <span className="mt-1 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
                <Upload className="size-4" aria-hidden />
                {t.upload.choose}
              </span>
            )}
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={progress !== null}
              onChange={(e) => {
                void send(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-4 text-primary" aria-hidden />
                {t.upload.template}
              </p>
              <p className="flex-1 text-sm text-ink-2">{t.upload.templateText}</p>
              <Button asChild variant="outline" size="sm" className="self-start">
                <a href={TEMPLATE_URL} download>
                  <Download />
                  {t.upload.templateDownload}
                </a>
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <p className="font-semibold">{t.upload.sources}</p>
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map((s) => (
                  <Badge key={s} tone="neutral">
                    {t.sources[s]}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-ink-2">{t.upload.sourcesText}</p>
            </div>
          </div>
          <div className="rounded-xl bg-surface-2/60 p-4">
            <p className="mb-2 text-sm font-semibold">{t.upload.tipsTitle}</p>
            <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-ink-2">
              {t.upload.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}

/* ---------- 2 + 3 ---------- */

function ImportView({ id, onReset }: { id: number; onReset: () => void }) {
  const query = useImport(id);
  if (query.isPending) return <Skeleton className="h-[28rem] rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const data = query.data;
  return data.status === "uploaded" ? <MappingStep key={data.id} data={data} onReset={onReset} /> : <RunStep data={data} onReset={onReset} />;
}

const optionsSchema = z.object({
  mapping: z.record(z.string(), z.union([z.string(), z.array(z.string())]).optional()),
  match: z.boolean(),
  existing: z.enum(["update", "skip"]),
  visible: z.boolean(),
});
type MappingValues = z.infer<typeof optionsSchema>;

function MappingStep({ data, onReset }: { data: ProductImport; onReset: () => void }) {
  const refresh = useRefreshImports();
  const headers = data.headers ?? [];
  const samples = data.samples ?? [];
  const multi = data.multi ?? ["images"];
  const initial = Object.fromEntries(Object.entries(data.mapping ?? {}).map(([field, col]) => [field, Array.isArray(col) ? col.map(String) : String(col)]));
  const form = useForm<MappingValues>({
    resolver: zodResolver(optionsSchema),
    defaultValues: { mapping: initial, match: data.options.match !== "none", existing: data.options.existing === "skip" ? "skip" : "update", visible: data.options.visible !== false },
  });
  const mapping = useWatch({ control: form.control, name: "mapping" });
  const match = useWatch({ control: form.control, name: "match" });
  const [serverErrors, setServerErrors] = React.useState<Record<string, string>>({});

  const used = new Set(Object.values(mapping).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : [])));
  const unused = headers.filter((_, i) => !used.has(String(i))).length;
  const sampleOf = (col: number) => samples.map((row) => row[col] ?? "").find((v) => v !== "") ?? "";
  const columnOptions = headers.map((h, i) => ({ value: String(i), label: h || `#${i + 1}`, hint: sampleOf(i).slice(0, 40) || undefined }));
  const detected = data.source !== "generic";

  const submit = form.handleSubmit(async (v) => {
    setServerErrors({});
    const clean: ImportMapping = {};
    for (const [field, col] of Object.entries(v.mapping)) {
      if (col === undefined) continue;
      if (Array.isArray(col) ? col.length > 0 : col !== "") clean[field] = Array.isArray(col) ? col.map(Number) : Number(col);
    }
    try {
      await startImport(data.id, clean, { match: v.match ? "sku" : "none", existing: v.existing, visible: v.visible });
      await refresh();
    } catch (e) {
      if (isApiError(e)) setServerErrors(Object.fromEntries(Object.entries(e.errors).map(([k, m]) => [k.replace(/^mapping\./, ""), m[0]])));
      toast.error(errorMessage(e));
    }
  });

  async function another() {
    try {
      await deleteImport(data.id);
    } catch {
      // Already gone: just go back to the upload.
    }
    await refresh();
    onReset();
  }

  return (
    <form onSubmit={submit} noValidate>
      <Steps current={1} />
      <div className="flex flex-col gap-4">
        <div className={cn("flex items-start gap-3 rounded-xl p-4 text-sm", detected ? "bg-brand-soft text-brand-strong" : "bg-info-soft text-info")}>
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold text-ink">{t.mapping.file(data.file_name, data.total_rows)}</p>
            <p>{detected ? t.detected(t.sources[data.source] ?? data.source) : t.guessed}</p>
          </div>
        </div>
        {data.room !== null && data.room !== undefined && data.total_rows > data.room ? <Alert tone="warning">{t.mapping.room(data.room, data.total_rows)}</Alert> : null}

        <Panel>
          <PanelHeader title={t.mapping.title} description={unused > 0 ? t.mapping.unused(unused) : undefined} />
          <PanelBody className="flex flex-col gap-6">
            {FIELD_GROUPS.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 text-xs font-semibold text-ink-3">{t.mapping.groups[group.key]}</h3>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {group.fields.map((field) => {
                    const meta = t.fields[field];
                    const required = (field === "name" || field === "price") && !match;
                    const value = mapping[field];
                    const error = serverErrors[field];
                    const firstCol = Array.isArray(value) ? value[0] : value;
                    const sample = firstCol !== undefined && firstCol !== "" ? sampleOf(Number(firstCol)) : "";
                    return (
                      <div key={field} className="grid grid-cols-1 items-center gap-2 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-4">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            {meta?.label ?? field}
                            {required ? <span className="text-[11px] font-normal text-danger">{t.mapping.required}</span> : null}
                            {value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0) ? <CheckCircle2 className="size-3.5 text-primary" aria-hidden /> : null}
                          </p>
                          {meta?.hint ? <p className="text-xs text-ink-3">{meta.hint}</p> : null}
                        </div>
                        <div className="min-w-0">
                          <Controller
                            control={form.control}
                            name={`mapping.${field}`}
                            render={({ field: f }) =>
                              multi.includes(field) ? (
                                <MultiSelect aria-label={meta?.label ?? field} value={Array.isArray(f.value) ? f.value : f.value ? [f.value] : []} onChange={f.onChange} options={columnOptions} placeholder={t.mapping.pickMany} invalid={!!error} />
                              ) : (
                                <Select aria-label={meta?.label ?? field} value={typeof f.value === "string" ? f.value : ""} onValueChange={f.onChange} options={columnOptions} emptyLabel={t.mapping.ignore} placeholder={t.mapping.pick} invalid={!!error} />
                              )
                            }
                          />
                          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : sample ? <p className="mt-1 truncate text-xs text-ink-3">{t.mapping.sample} <span className="text-ink-2">{sample}</span></p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title={t.options.title} />
          <PanelBody className="flex flex-col gap-2">
            <Controller control={form.control} name="match" render={({ field }) => <SwitchRow title={t.options.match} description={t.options.matchHint} checked={field.value} onCheckedChange={field.onChange} />} />
            {match ? (
              <div className="flex flex-col gap-2 rounded-lg bg-surface-2/60 p-3">
                <p className="text-sm font-semibold">{t.options.existing}</p>
                <Controller
                  control={form.control}
                  name="existing"
                  render={({ field }) => (
                    <Segmented
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "update", label: t.options.update },
                        { value: "skip", label: t.options.skip },
                      ]}
                    />
                  )}
                />
                <p className="text-xs text-ink-3">{t.options.updateHint}</p>
              </div>
            ) : null}
            <Controller control={form.control} name="visible" render={({ field }) => <SwitchRow title={t.options.visible} description={t.options.visibleHint} checked={field.value} onCheckedChange={field.onChange} />} />
          </PanelBody>
        </Panel>

        {samples.length > 0 ? (
          <details className="rounded-xl border border-border bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{t.mapping.preview}</summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-max text-xs">
                <thead className="bg-surface-2/60 text-ink-3">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 text-start font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {samples.map((row, r) => (
                    <tr key={r}>
                      {headers.map((_, i) => (
                        <td key={i} className="max-w-56 truncate px-3 py-2">
                          {row[i] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
          <Button type="button" variant="ghost" onClick={() => void another()}>
            {t.mapping.another}
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {t.mapping.start}
            <ArrowRight className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </form>
  );
}

function duration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? t.run.seconds(s) : t.run.minutes(Math.round(s / 60));
}

/** The current time, ticking every second while `running` (elapsed / remaining time). */
function useClock(running: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

function RunStep({ data, onReset }: { data: ProductImport; onReset: () => void }) {
  const refresh = useRefreshImports();
  const [confirm, setConfirm] = React.useState(false);
  const [stopping, setStopping] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const active = isActive(data);
  const finished = !active;
  const failures = useFailures(data.id, page, finished && data.failed > 0);
  const percent = data.total_products > 0 ? Math.min(100, Math.round((data.processed / data.total_products) * 100)) : 0;
  const now = useClock(active);
  const startedAt = data.started_at ? new Date(data.started_at).getTime() : null;
  const elapsed = startedAt ? (data.finished_at ? new Date(data.finished_at).getTime() : now) - startedAt : 0;
  const remaining = active && data.processed > 0 && data.total_products > data.processed ? (elapsed / data.processed) * (data.total_products - data.processed) : null;

  React.useEffect(() => {
    if (data.status === "completed") void refresh();
    // Refresh the history once when the import finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.status]);

  async function stop() {
    setStopping(true);
    try {
      await cancelImport(data.id);
      toast.success(t.run.cancelled_);
      setConfirm(false);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStopping(false);
    }
  }

  const head = {
    queued: { icon: Loader2, tone: "text-info", spin: true },
    processing: { icon: Loader2, tone: "text-info", spin: true },
    completed: { icon: CheckCircle2, tone: "text-success", spin: false },
    failed: { icon: XCircle, tone: "text-danger", spin: false },
    cancelled: { icon: PauseCircle, tone: "text-ink-3", spin: false },
    uploaded: { icon: Loader2, tone: "text-info", spin: true },
  }[data.status];
  const HeadIcon = head.icon;

  return (
    <>
      <Steps current={2} />
      <div className="flex flex-col gap-4">
        <Panel>
          <PanelBody className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start gap-3">
              <HeadIcon className={cn("mt-0.5 size-6 shrink-0", head.tone, head.spin && "animate-spin")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold" role="status">
                  {t.run[data.status as "queued" | "processing" | "completed" | "failed" | "cancelled"]}
                </p>
                <p className="truncate text-sm text-ink-3">{data.file_name}</p>
              </div>
              {active ? (
                <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
                  {t.run.cancel}
                </Button>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold tabular">{t.run.progress(data.processed, data.total_products || data.total_rows)}</span>
                <span className="text-ink-3">
                  {startedAt ? t.run.elapsed(duration(elapsed)) : null}
                  {remaining !== null ? ` · ${t.run.remaining(duration(remaining))}` : null}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className={cn("h-full rounded-full transition-[width] duration-700", data.status === "failed" ? "bg-danger" : data.status === "cancelled" ? "bg-ink-3" : "bg-primary")} style={{ width: `${data.status === "completed" ? 100 : percent}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t.run.created, value: data.created, tone: "text-success" },
                { label: t.run.updated, value: data.updated, tone: "text-info" },
                { label: t.run.skipped, value: data.skipped, tone: "text-ink-2" },
                { label: t.run.failed_, value: data.failed, tone: data.failed ? "text-danger" : "text-ink-2" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border p-3">
                  <p className="text-xs text-ink-3">{c.label}</p>
                  <p className={cn("font-display text-2xl font-bold tabular", c.tone)}>{formatNumber(c.value)}</p>
                </div>
              ))}
            </div>

            {data.images.total > 0 ? (
              <div className="rounded-xl bg-surface-2/60 p-3">
                <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-semibold">{t.run.images}</span>
                  <span className="tabular text-ink-2">{t.run.imagesProgress(data.images.done, data.images.total, data.images.failed)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-chart-2 transition-[width] duration-700" style={{ width: `${Math.round(((data.images.done + data.images.failed) / data.images.total) * 100)}%` }} />
                </div>
                {imagesPending(data) ? <p className="mt-1.5 text-xs text-ink-3">{t.run.imagesHint}</p> : null}
              </div>
            ) : null}

            {active ? <p className="text-xs text-ink-3">{t.run.leaveHint}</p> : null}
            {data.error ? <Alert tone="danger">{data.error}</Alert> : null}
            {data.warnings.length > 0 ? (
              <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-warning">
                  <AlertTriangle className="size-4" aria-hidden />
                  {t.run.notes}
                </p>
                <ul className="flex list-disc flex-col gap-0.5 ps-5 text-ink-2">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {finished ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={onReset}>
                  <Upload />
                  {t.run.new}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/catalog/products">
                    <Package />
                    {t.run.toProducts}
                  </Link>
                </Button>
              </div>
            ) : null}
          </PanelBody>
        </Panel>

        {finished && data.failed > 0 ? (
          <Panel>
            <PanelHeader
              title={t.failures.title(data.failed)}
              description={t.failures.text}
              actions={
                <Button asChild variant="outline" size="sm">
                  <a href={failuresFileUrl(data.id)} download>
                    <Download />
                    {t.failures.download}
                  </a>
                </Button>
              }
            />
            <PanelBody className="p-0">
              {failures.isPending ? (
                <Skeleton className="m-4 h-40" />
              ) : failures.isError ? (
                <ErrorState onRetry={() => void failures.refetch()} message={errorMessage(failures.error)} />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="border-y border-border bg-surface-2/60 text-xs text-ink-3">
                        <tr>
                          <th className="px-4 py-2 text-start font-semibold">{t.failures.row}</th>
                          <th className="px-4 py-2 text-start font-semibold">{t.failures.identifier}</th>
                          <th className="px-4 py-2 text-start font-semibold">{t.failures.name}</th>
                          <th className="px-4 py-2 text-start font-semibold">{t.failures.reasons}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {failures.data.data.map((f) => (
                          <tr key={f.id} className="align-top">
                            <td className="px-4 py-2.5 font-semibold tabular">{f.row_number}</td>
                            <td dir="ltr" className="px-4 py-2.5 text-end tabular text-ink-2">
                              {f.identifier ?? "—"}
                            </td>
                            <td className="max-w-56 px-4 py-2.5">{f.name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-danger">
                              <ul className="flex flex-col gap-0.5">
                                {f.reasons.map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {failures.data.meta.last_page > 1 ? (
                    <div className="border-t border-border p-3">
                      <Pagination page={failures.data.meta.current_page} lastPage={failures.data.meta.last_page} total={failures.data.meta.total} onPageChange={setPage} />
                    </div>
                  ) : null}
                </>
              )}
            </PanelBody>
          </Panel>
        ) : finished && data.status === "completed" && data.created + data.updated > 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            {t.failures.none}
          </p>
        ) : null}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t.run.cancelTitle} description={t.run.cancelText} confirmLabel={t.run.cancel} destructive loading={stopping} onConfirm={() => void stop()} />
    </>
  );
}

/* ---------- history ---------- */

function HistoryList({ items, loading, activeId, onOpen }: { items: ProductImport[] | undefined; loading: boolean; activeId: number | null; onOpen: (id: number) => void }) {
  const refresh = useRefreshImports();
  const [removing, setRemoving] = React.useState<ProductImport | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteImport(removing.id);
      toast.success(t.history.removed);
      setRemoving(null);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside>
      <Panel>
        <PanelHeader title={<span className="flex items-center gap-2"><History className="size-4 text-ink-3" aria-hidden />{t.history.title}</span>} />
        <PanelBody className="p-0">
          {loading ? (
            <Skeleton className="m-4 h-32" />
          ) : !items || items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-3">{t.history.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className={cn("group flex items-start gap-2 px-4 py-3", item.id === activeId && "bg-brand-soft/50")}>
                  <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-start">
                    <p className="truncate text-sm font-semibold">{item.file_name}</p>
                    <p className="text-xs text-ink-3">{item.created_at ? formatDateTime(item.created_at) : ""}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                      <Badge size="sm" tone={STATUS_TONE[item.status]} dot>
                        {t.history.status[item.status]}
                      </Badge>
                      {item.status !== "uploaded" ? t.history.summary(item.created, item.updated, item.failed) : null}
                    </p>
                  </button>
                  {!isActive(item) ? (
                    <button type="button" onClick={() => setRemoving(item)} aria-label={`${t.history.remove}: ${item.file_name}`} className="rounded-md p-1 text-ink-3 opacity-60 hover:bg-surface-2 hover:text-danger group-hover:opacity-100">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
      <ConfirmDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)} title={t.history.remove} description={removing?.file_name} confirmLabel={t.history.remove} destructive loading={busy} onConfirm={() => void remove()} />
    </aside>
  );
}
