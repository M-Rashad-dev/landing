"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, ExternalLink, ImageOff, ReceiptText, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/data/data-table";
import { DescriptionList, EntityCell } from "@/components/data/details";
import { DateRangePicker, type RangeValue } from "@/components/forms/date-pickers";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { approvePayment, PAYMENT_TABS, receiptUrl, rejectPayment, usePaymentMethods, usePayments, useRefreshMoney, type PaymentFilters, type PaymentRow, type PaymentTab } from "./payments-api";

const t = ar.admin.payments;
const d = t.dialog;

const STATUS_TONE = { pending_review: "attention", approved: "success", rejected: "danger" } as const;

export function itemOf(p: PaymentRow): string {
  if (!p.invoice) return "—";
  return p.invoice.type === "theme" ? t.theme(p.invoice.plan_name) : t.plan(p.invoice.plan_name, p.invoice.period);
}

export function PaymentsPage() {
  const [url, setUrl] = useUrlState(["tab", "q", "method", "from", "to", "preset", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const [open, setOpen] = React.useState<PaymentRow | null>(null);
  const methods = usePaymentMethods();
  const filters: PaymentFilters = {
    tab: (PAYMENT_TABS as readonly string[]).includes(url.tab) ? (url.tab as PaymentTab) : "pending_review",
    q: url.q,
    method: url.method,
    from: url.from,
    to: url.to,
    page: Math.max(1, Number(url.page) || 1),
  };
  const range: RangeValue = url.from ? { from: url.from, to: url.to || url.from, preset: (url.preset as RangeValue["preset"]) || "custom" } : { from: "", to: "", preset: "all" };
  const query = usePayments(filters);
  const filtered = Boolean(filters.q || filters.method || filters.from);
  const rows = query.data?.data;

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const columns: Column<PaymentRow>[] = [
    {
      key: "store",
      header: t.columns.store,
      cell: (p) => (
        <EntityCell
          avatar={p.tenant.name}
          title={p.tenant.name}
          subtitle={
            <span dir="ltr" className="tabular">
              {p.tenant.reference}
            </span>
          }
        />
      ),
    },
    { key: "item", header: t.columns.item, hideOnMobile: true, cell: (p) => <span className="text-sm">{itemOf(p)}</span> },
    { key: "amount", header: t.columns.amount, align: "end", cell: (p) => <span className="tabular font-semibold">{formatMoney(p.amount)}</span> },
    { key: "method", header: t.columns.method, hideOnMobile: true, cell: (p) => <span className="text-sm text-ink-2">{p.method.name}</span> },
    {
      key: "reference",
      header: t.columns.reference,
      hideOnMobile: true,
      cell: (p) => (
        <span className="flex flex-col items-start gap-1">
          <span dir="ltr" className="tabular text-sm">
            {p.sender_ref}
          </span>
          {p.repeated_ref ? (
            <Badge tone="warning" size="sm">
              <AlertTriangle />
              {t.repeated}
            </Badge>
          ) : null}
        </span>
      ),
    },
    { key: "date", header: t.columns.date, hideOnMobile: true, cell: (p) => <span className="tabular text-xs text-ink-3">{formatDateTime(p.created_at)}</span> },
    {
      key: "status",
      header: t.columns.status,
      cell: (p) =>
        p.status === "pending_review" ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(p)}>
            {t.review}
          </Button>
        ) : (
          <Badge tone={STATUS_TONE[p.status]} size="sm" dot>
            {t.status[p.status]}
          </Badge>
        ),
    },
  ];

  const counts = query.data?.meta.counts;
  const pendingEmpty = filters.tab === "pending_review" && !filtered;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={filters.tab} onValueChange={(v) => setUrl({ tab: v === "pending_review" ? null : v, page: null })}>
            <TabsList>
              {PAYMENT_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} count={counts?.[tab]}>
                  {t.tabs[tab]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t.search}
        filters={
          <Select
            aria-label={t.methodLabel}
            value={filters.method || "all"}
            onValueChange={(v) => setUrl({ method: v === "all" ? null : v, page: null })}
            options={[{ value: "all", label: t.allMethods }, ...(methods.data ?? []).map((m) => ({ value: m.key, label: m.name }))]}
            searchable={false}
            className="w-48"
          />
        }
        actions={<DateRangePicker value={range} onChange={(r) => (r.preset === "all" || !r.from ? setUrl({ from: null, to: null, preset: null, page: null }) : setUrl({ from: r.from, to: r.to || null, preset: r.preset, page: null }))} />}
      />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.isPending ? undefined : rows}
            rowKey={(p) => p.id}
            loading={query.isPending}
            onRowClick={(p) => setOpen(p)}
            empty={<EmptyState icon={ReceiptText} title={pendingEmpty ? t.emptyPending : t.empty} description={pendingEmpty ? t.emptyPendingText : t.emptyText} />}
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
      <ReviewDialog payment={open} queue={rows ?? []} onClose={() => setOpen(null)} onNext={setOpen} />
    </>
  );
}

const rejectSchema = z.object({ reason: z.string().trim().min(3, d.reasonRequired).max(500) });

/**
 * One receipt: the image next to what it is for. Approving or rejecting moves straight to the
 * next receipt waiting on the page, so the queue is worked through without going back.
 */
export function ReviewDialog({ payment, queue, onClose, onNext }: { payment: PaymentRow | null; queue: PaymentRow[]; onClose: () => void; onNext: (p: PaymentRow) => void }) {
  // Receipts decided while the dialog is open (the list may not have refetched yet).
  const [done, setDone] = React.useState<Set<number>>(() => new Set());
  if (!payment) return null;
  const waiting = queue.filter((q) => q.status === "pending_review" && q.id !== payment.id && !done.has(q.id));

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="xl">
        {/* Keyed: every receipt opens on its details with a clean reason box. */}
        <ReviewBody
          key={payment.id}
          p={payment}
          waiting={waiting.length}
          onDecided={() => {
            setDone((prev) => new Set(prev).add(payment.id));
            if (waiting.length > 0) onNext(waiting[0]);
            else {
              toast.success(d.done);
              onClose();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ReviewBody({ p, waiting, onDecided }: { p: PaymentRow; waiting: number; onDecided: () => void }) {
  const refresh = useRefreshMoney();
  const [mode, setMode] = React.useState<"view" | "approve" | "reject">("view");
  const [busy, setBusy] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const form = useForm<z.infer<typeof rejectSchema>>({ resolver: zodResolver(rejectSchema), defaultValues: { reason: "" } });
  const pending = p.status === "pending_review";

  async function finish(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await refresh();
      onDecided();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const reject = form.handleSubmit((v) => finish(() => rejectPayment(p.id, v.reason.trim()), d.rejected));

  return (
    <>
        <DialogHeader title={d.title(p.invoice?.number ?? String(p.id))} description={pending && waiting > 0 ? d.next(waiting) : undefined} />
        <DialogBody className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            {p.repeated_ref ? (
              <Alert tone="warning" title={t.repeated}>
                {t.repeatedText}
              </Alert>
            ) : null}
            <DescriptionList
              columns={2}
              items={[
                {
                  label: d.store,
                  value: (
                    <Link href={`/admin/stores/${p.tenant.id}`} className="font-semibold hover:underline">
                      {p.tenant.name}
                    </Link>
                  ),
                },
                { label: d.storeReference, value: <span dir="ltr" className="tabular">{p.tenant.reference}</span> },
                { label: d.item, value: itemOf(p), wide: true },
                { label: d.amount, value: <span className="tabular font-display text-lg font-semibold">{formatMoney(p.amount)}</span> },
                { label: d.method, value: p.method.name },
                { label: d.reference, value: <span dir="ltr" className="tabular font-semibold">{p.sender_ref}</span> },
                { label: d.sentAt, value: formatDateTime(p.created_at) },
                ...(p.reviewed_at ? [{ label: d.reviewedAt, value: formatDateTime(p.reviewed_at) }] : []),
                ...(p.reject_reason ? [{ label: d.rejectReason, value: p.reject_reason, wide: true }] : []),
              ]}
            />
            {pending && p.invoice?.type !== "theme" ? <p className="text-xs text-ink-3">{p.invoice?.starts_now ? d.startsNow : d.startsLater}</p> : null}
            {pending && mode === "view" ? <Alert tone="info">{d.check}</Alert> : null}

            {mode === "approve" ? (
              <Alert tone="success" title={d.approveTitle}>
                {d.approveText(formatMoney(p.amount), p.tenant.name)}
              </Alert>
            ) : null}

            {mode === "reject" ? (
              <form id="reject-form" onSubmit={reject} noValidate className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft/40 p-3">
                <p className="text-sm font-semibold">{d.rejectTitle}</p>
                <p className="text-xs text-ink-2">{d.rejectText}</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.quickReasons.map((r) => (
                    <button key={r} type="button" onClick={() => form.setValue("reason", r, { shouldValidate: true })} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-border-strong">
                      {r}
                    </button>
                  ))}
                </div>
                <Field label={d.reason} htmlFor="reject-reason" error={form.formState.errors.reason?.message} required>
                  <Textarea id="reject-reason" rows={2} aria-invalid={Boolean(form.formState.errors.reason)} {...form.register("reason")} />
                </Field>
              </form>
            ) : null}
          </div>

          <figure className="flex flex-col gap-2">
            <figcaption className="flex items-center justify-between text-[13px] font-semibold">
              {d.receipt}
              <a href={receiptUrl(p.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-normal text-ink-2 hover:text-ink">
                <ExternalLink className="size-3.5" aria-hidden />
                {d.openFull}
              </a>
            </figcaption>
            <div className="flex max-h-[60vh] min-h-64 items-start justify-center overflow-auto rounded-lg border border-border bg-surface-2">
              {imageFailed ? (
                <span className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-ink-3">
                  <ImageOff className="size-6" aria-hidden />
                  {d.receiptError}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- private image streamed through the BFF (not optimizable)
                <img src={receiptUrl(p.id)} alt={d.receipt} className="w-full object-contain" onError={() => setImageFailed(true)} />
              )}
            </div>
          </figure>
        </DialogBody>
        {pending ? (
          <DialogFooter>
            {mode === "view" ? (
              <>
                <Button variant="outline" onClick={() => setMode("reject")}>
                  <X />
                  {d.reject}
                </Button>
                <Button onClick={() => setMode("approve")}>
                  <Check />
                  {d.approve}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode("view")} disabled={busy}>
                  {ar.common.back}
                </Button>
                {mode === "approve" ? (
                  <Button loading={busy} onClick={() => void finish(() => approvePayment(p.id), d.approved)}>
                    <Check />
                    {d.approve}
                  </Button>
                ) : (
                  <Button type="submit" form="reject-form" variant="danger" loading={busy}>
                    <X />
                    {d.reject}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        ) : null}
    </>
  );
}
