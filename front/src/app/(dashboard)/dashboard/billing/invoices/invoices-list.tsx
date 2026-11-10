"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ReceiptText, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status";
import { PRICING_PATH } from "@/components/billing/plan";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { requestRefund, useInvoices, type Invoice } from "@/lib/billing/payments";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";
import { invoiceItem } from "./[id]/invoice-view";

const t = ar.billing.invoices;

export function InvoicesList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useInvoices(page);

  const columns: Column<Invoice>[] = [
    { key: "number", header: t.number, cell: (row) => <span dir="ltr" className="font-mono font-semibold">{row.number}</span> },
    { key: "plan", header: ar.billing.plan.current, cell: (row) => invoiceItem(row) },
    { key: "date", header: t.date, cell: (row) => formatCairo(row.created_at, { withTime: false }) },
    { key: "total", header: t.total, cell: (row) => <span className="font-semibold tabular-nums">{formatPrice(row.total)}</span> },
    { key: "status", header: t.status, cell: (row) => <InvoiceStatusBadge status={row.status} /> },
  ];

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      {data?.refundableId ? <RefundCard /> : null}
      {!isPending && data?.data.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={t.empty}
          description={t.emptyText}
          action={
            <Button asChild>
              <Link href={PRICING_PATH}>{ar.billing.seePlans}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <DataTable columns={columns} rows={data?.data} rowKey={(row) => row.id} loading={isPending} onRowClick={(row) => router.push(`/dashboard/billing/invoices/${row.id}`)} />
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

const refundSchema = z.object({ reason: z.string().trim().min(3, ar.validation.min(3)).max(500) });

/** Shown only while the current paid period can still be refunded (3 days, once per 6 months). */
function RefundCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof refundSchema>>({ resolver: zodResolver(refundSchema), defaultValues: { reason: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof refundSchema>) {
    try {
      await requestRefund(values.reason);
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(t.refundSent);
      setOpen(false);
      router.refresh();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["reason"]);
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">{t.refundTitle}</p>
        <p className="text-sm text-muted-foreground">{t.refundText}</p>
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Undo2 />
        {t.refundAsk}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (!isSubmitting ? setOpen(next) : undefined)}>
        <DialogContent size="sm">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>{t.refundTitle}</DialogTitle>
              <DialogDescription>{t.refundText}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <FormField label={t.refundReason} htmlFor="refund-reason" error={errors.reason?.message} required>
                <Textarea id="refund-reason" rows={3} {...form.register("reason")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                {ar.common.cancel}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {t.refundSend}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
