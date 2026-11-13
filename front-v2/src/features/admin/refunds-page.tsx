"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Undo2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { completeRefund, useRefreshMoney, useRefunds, type RefundRow } from "./payments-api";

const t = ar.admin.refunds;

export function RefundsPage() {
  const [url, setUrl] = useUrlState(["tab"] as const);
  const tab = url.tab === "done" ? "done" : "open";
  const query = useRefunds();
  const [open, setOpen] = React.useState<RefundRow | null>(null);
  const all = query.data ?? [];
  const rows = all.filter((r) => (tab === "open" ? r.status === "paid" : r.status === "refunded"));

  const columns: Column<RefundRow>[] = [
    {
      key: "store",
      header: t.columns.store,
      cell: (r) => (
        <Link href={`/admin/stores/${r.tenant.id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
          {r.tenant.name}
        </Link>
      ),
    },
    {
      key: "invoice",
      header: t.columns.invoice,
      hideOnMobile: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span dir="ltr" className="tabular text-start text-sm">
            {r.number}
          </span>
          <span className="text-xs text-ink-3">{r.plan_name}</span>
        </span>
      ),
    },
    { key: "amount", header: t.columns.amount, align: "end", cell: (r) => <span className="tabular font-semibold">{formatMoney(r.total)}</span> },
    { key: "reason", header: t.columns.reason, hideOnMobile: true, cell: (r) => <span className="line-clamp-2 text-sm text-ink-2">{r.refund_reason ?? "—"}</span> },
    { key: "requested", header: t.columns.requestedAt, hideOnMobile: true, cell: (r) => <span className="tabular text-xs text-ink-3">{formatDateTime(r.refund_requested_at)}</span> },
    {
      key: "action",
      header: tab === "open" ? "" : t.columns.refundRef,
      cell: (r) =>
        r.status === "paid" ? (
          <Button size="sm" onClick={() => setOpen(r)}>
            {t.complete}
          </Button>
        ) : (
          <span className="flex flex-col">
            <span dir="ltr" className="tabular text-start text-sm font-semibold">
              {r.refund_ref}
            </span>
            <span className="text-xs text-ink-3">{t.doneAt(formatDateTime(r.refunded_at))}</span>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v === "open" ? null : v })}>
            <TabsList>
              <TabsTrigger value="open" count={query.data ? all.filter((r) => r.status === "paid").length : undefined}>
                {t.tabs.open}
              </TabsTrigger>
              <TabsTrigger value="done">{t.tabs.done}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <DataTable
          columns={columns}
          rows={query.isPending ? undefined : rows}
          rowKey={(r) => r.id}
          loading={query.isPending}
          empty={<EmptyState icon={Undo2} title={tab === "open" ? t.emptyOpen : t.emptyDone} description={tab === "open" ? t.emptyOpenText : undefined} />}
        />
      )}
      <RefundDialog refund={open} onClose={() => setOpen(null)} />
    </>
  );
}

const schema = z.object({ refund_ref: z.string().trim().min(3, t.refundRefRequired).max(120) });

function RefundDialog({ refund, onClose }: { refund: RefundRow | null; onClose: () => void }) {
  const refresh = useRefreshMoney();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { refund_ref: "" } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    if (!refund) return;
    try {
      await completeRefund(refund.id, v.refund_ref.trim());
      toast.success(t.done);
      await refresh();
      form.reset();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={refund !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="sm">
        {refund ? (
          <>
            <DialogHeader title={t.dialogTitle(refund.number)} description={t.dialogText(formatMoney(refund.total), refund.tenant.name)} />
            <form onSubmit={submit} noValidate>
              <DialogBody>
                <Field label={t.refundRef} htmlFor="refund-ref" error={errors.refund_ref?.message} required>
                  <Input id="refund-ref" dir="ltr" className="tabular" aria-invalid={Boolean(errors.refund_ref)} {...form.register("refund_ref")} />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {ar.common.cancel}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {t.confirm}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
