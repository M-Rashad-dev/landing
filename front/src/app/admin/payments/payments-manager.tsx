"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Image as ImageIcon, Undo2, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PaymentStatusBadge } from "@/components/billing/invoice-status";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Pagination } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  adminKeys,
  adminReceiptUrl,
  approvePayment,
  completeRefund,
  paymentKeys,
  rejectPayment,
  updatePaymentMethod,
  useAdminPaymentMethods,
  useAdminPayments,
  useAdminRefunds,
  type AdminPayment,
  type AdminPaymentMethod,
  type AdminRefund,
} from "@/lib/admin/api";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.admin.payments;
const TABS = ["pending_review", "approved", "rejected", "all", "refunds", "methods"] as const;
type Tab = (typeof TABS)[number];

function toastError(error: unknown, unmatched: string[] = []) {
  if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
}

export function PaymentsManager() {
  const [tab, setTab] = useState<Tab>("pending_review");

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t.tabs[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "refunds" ? <RefundsList /> : tab === "methods" ? <MethodsList /> : <PaymentsList key={tab} status={tab} />}
    </div>
  );
}

function PaymentsList({ status }: { status: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useAdminPayments(status, page);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-48 rounded-xl" />;
  if (data.data.length === 0) return <EmptyState icon={Wallet} title={t.empty} />;

  return (
    <>
      <ul className="grid gap-4 lg:grid-cols-2">
        {data.data.map((payment) => (
          <li key={payment.id}>
            <PaymentCard payment={payment} />
          </li>
        ))}
      </ul>
      <Pagination meta={data.meta} onPageChange={setPage} />
    </>
  );
}

function PaymentCard({ payment }: { payment: AdminPayment }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"receipt" | "approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const invoice = payment.invoice;
  const mismatch = invoice !== null && payment.amount !== invoice.total;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    void queryClient.invalidateQueries({ queryKey: ["admin", "tenant-billing"] });
  };

  async function approve() {
    setBusy(true);
    try {
      await approvePayment(payment.id);
      toast.success(t.approved);
      setDialog(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-semibold">{value}</dd>
    </div>
  );

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/admin/tenants/${payment.tenant.id}`} className="font-bold hover:underline">
            {payment.tenant.name}
          </Link>
          {payment.tenant.reference ? (
            <span className="ms-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs" dir="ltr" title={ar.billing.invoices.reference}>
              {payment.tenant.reference}
            </span>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t.sentAt} {formatCairo(payment.created_at)}
          </p>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <dl className="divide-y text-sm">
        {row(t.invoice, <span dir="ltr">{invoice?.number}</span>)}
        {invoice ? row(ar.billing.plan.current, `${invoice.plan_name} · ${invoice.period ? ar.billing.periods[invoice.period] : ""}`) : null}
        {row(t.expected, <span className={mismatch ? "text-destructive" : "tabular-nums"}>{formatPrice(invoice?.total ?? payment.amount)}</span>)}
        {row(t.method, payment.method.name)}
        {row(t.senderRef, <span dir="ltr">{payment.sender_ref}</span>)}
      </dl>
      {invoice ? <p className="text-xs text-muted-foreground">{invoice.starts_now ? t.startsNow : t.startsLater}</p> : null}
      {payment.reject_reason ? <p className="text-sm font-semibold text-destructive">{ar.billing.invoices.rejectedReason(payment.reject_reason)}</p> : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => setDialog("receipt")}>
          <ImageIcon />
          {t.viewReceipt}
        </Button>
        {payment.status === "pending_review" ? (
          <>
            <Button size="sm" onClick={() => setDialog("approve")}>
              <Check />
              {t.approve}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("reject")}>
              <X />
              {t.reject}
            </Button>
          </>
        ) : null}
      </div>

      <Dialog open={dialog === "receipt"} onOpenChange={(open) => setDialog(open ? "receipt" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.receiptTitle(invoice?.number ?? "")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {/* eslint-disable-next-line @next/next/no-img-element -- private image streamed through the BFF */}
            <img src={adminReceiptUrl(payment.id)} alt={t.receiptTitle(invoice?.number ?? "")} className="mx-auto max-h-[70dvh] rounded-lg object-contain" />
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(open) => setDialog(open ? "approve" : null)}
        title={t.approveTitle}
        description={t.approveText(formatPrice(invoice?.total ?? payment.amount), invoice?.plan_name ?? "")}
        confirmLabel={t.approve}
        loading={busy}
        onConfirm={approve}
      />
      <RejectDialog open={dialog === "reject"} onClose={() => setDialog(null)} paymentId={payment.id} onDone={refresh} />
    </Card>
  );
}

const reasonSchema = z.object({ reason: z.string().trim().min(3, ar.validation.min(3)).max(500) });

function RejectDialog({ open, onClose, paymentId, onDone }: { open: boolean; onClose: () => void; paymentId: number; onDone: () => void }) {
  const form = useForm<z.infer<typeof reasonSchema>>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof reasonSchema>) {
    try {
      await rejectPayment(paymentId, values.reason);
      toast.success(t.rejected);
      form.reset();
      onClose();
      onDone();
    } catch (error) {
      toastError(error, applyServerErrors(error, form.setError, ["reason"]));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !isSubmitting ? onClose() : undefined)}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t.rejectTitle}</DialogTitle>
            <DialogDescription>{t.rejectText}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label={t.reason} htmlFor={`reject-${paymentId}`} error={errors.reason?.message} required>
              <Textarea id={`reject-${paymentId}`} rows={3} {...form.register("reason")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" loading={isSubmitting}>
              {t.reject}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RefundsList() {
  const { data, isPending, isError, error, refetch } = useAdminRefunds();
  const [active, setActive] = useState<AdminRefund | null>(null);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-40 rounded-xl" />;
  if (data.length === 0) return <EmptyState icon={Undo2} title={t.refundsEmpty} />;

  return (
    <>
      <ul className="grid gap-4 lg:grid-cols-2">
        {data.map((refund) => (
          <li key={refund.id}>
            <Card className="flex h-full flex-col gap-2 p-5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/tenants/${refund.tenant.id}`} className="font-bold hover:underline">
                  {refund.tenant.name}
                </Link>
                <Badge variant={refund.refunded_at ? "outline" : "warning"}>{ar.billing.invoices.statuses[refund.status]}</Badge>
              </div>
              <p>
                <span dir="ltr">{refund.number}</span> · {refund.plan_name} · <span className="font-semibold">{formatPrice(refund.total)}</span>
              </p>
              <p className="text-muted-foreground">
                {t.requestedAt} {formatCairo(refund.refund_requested_at)}
              </p>
              {refund.refund_reason ? (
                <p>
                  {t.refundReason}: {refund.refund_reason}
                </p>
              ) : null}
              {refund.refunded_at ? (
                <p className="text-success">{t.refundedAt(formatCairo(refund.refunded_at), refund.refund_ref ?? "")}</p>
              ) : (
                <Button size="sm" className="mt-2 self-start" onClick={() => setActive(refund)}>
                  <Undo2 />
                  {t.completeRefund}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <RefundDialog refund={active} onClose={() => setActive(null)} />
    </>
  );
}

const refundSchema = z.object({ refund_ref: z.string().trim().min(3, ar.validation.min(3)).max(120) });

function RefundDialog({ refund, onClose }: { refund: AdminRefund | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof refundSchema>>({ resolver: zodResolver(refundSchema), defaultValues: { refund_ref: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof refundSchema>) {
    if (!refund) return;
    try {
      queryClient.setQueryData(paymentKeys.refunds, await completeRefund(refund.id, values.refund_ref));
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      toast.success(t.refunded);
      form.reset();
      onClose();
    } catch (error) {
      toastError(error, applyServerErrors(error, form.setError, ["refund_ref"]));
    }
  }

  return (
    <Dialog open={refund !== null} onOpenChange={(next) => (!next && !isSubmitting ? onClose() : undefined)}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t.refundTitle}</DialogTitle>
            <DialogDescription>{t.refundText}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label={t.refundRef} htmlFor="refund-ref" error={errors.refund_ref?.message} required>
              <Input id="refund-ref" dir="ltr" {...form.register("refund_ref")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.completeRefund}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MethodsList() {
  const { data, isPending, isError, error, refetch } = useAdminPaymentMethods();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <>
      <p className="text-sm text-muted-foreground">{t.methodHint}</p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {data.map((method) => (
          <li key={method.key}>
            <MethodForm method={method} />
          </li>
        ))}
      </ul>
    </>
  );
}

const methodSchema = z
  .object({
    name: z.string().trim().min(1, ar.validation.required).max(60),
    account_label: z.string().max(60),
    account_value: z.string().max(120),
    instructions: z.string().max(1000),
    is_active: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(1000),
  })
  .refine((v) => !v.is_active || v.account_value.trim() !== "", { path: ["account_value"], message: ar.validation.required });

function MethodForm({ method }: { method: AdminPaymentMethod }) {
  const queryClient = useQueryClient();
  const toForm = (m: AdminPaymentMethod) => ({ name: m.name, account_label: m.account_label ?? "", account_value: m.account_value ?? "", instructions: m.instructions ?? "", is_active: m.is_active, sort_order: m.sort_order });
  const form = useForm<z.input<typeof methodSchema>, unknown, z.output<typeof methodSchema>>({ resolver: zodResolver(methodSchema), defaultValues: toForm(method) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const id = (field: string) => `${method.key}-${field}`;

  async function onSubmit(values: z.output<typeof methodSchema>) {
    try {
      const saved = await updatePaymentMethod(method.key, {
        ...values,
        account_label: values.account_label.trim() || null,
        account_value: values.account_value.trim() || null,
        instructions: values.instructions.trim() || null,
      });
      queryClient.setQueryData<AdminPaymentMethod[]>(paymentKeys.methods, (list) => list?.map((m) => (m.key === saved.key ? saved : m)));
      form.reset(toForm(saved));
      toast.success(t.methodSaved);
    } catch (error) {
      toastError(error, applyServerErrors(error, form.setError, ["name", "account_label", "account_value", "instructions", "is_active", "sort_order"]));
    }
  }

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{method.name}</CardTitle>
          <Controller control={form.control} name="is_active" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t.methodActive} />} />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.methodName} htmlFor={id("name")} error={errors.name?.message} required>
            <Input id={id("name")} {...form.register("name")} />
          </FormField>
          <FormField label={ar.admin.plans.sortOrder} htmlFor={id("sort")} error={errors.sort_order?.message}>
            <Input id={id("sort")} type="number" dir="ltr" {...form.register("sort_order")} />
          </FormField>
          <FormField label={t.accountLabel} htmlFor={id("label")} error={errors.account_label?.message}>
            <Input id={id("label")} {...form.register("account_label")} />
          </FormField>
          <FormField label={t.accountValue} htmlFor={id("value")} error={errors.account_value?.message}>
            <Input id={id("value")} dir="ltr" {...form.register("account_value")} />
          </FormField>
          <FormField label={t.instructions} htmlFor={id("instructions")} error={errors.instructions?.message} className="sm:col-span-2">
            <Textarea id={id("instructions")} rows={3} {...form.register("instructions")} />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
