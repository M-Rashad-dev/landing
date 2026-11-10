"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock, Copy, Printer, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { InvoiceStatusBadge, PaymentStatusBadge } from "@/components/billing/invoice-status";
import { PRICING_PATH } from "@/components/billing/plan";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ErrorState } from "@/components/dashboard/error-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { cancelInvoice, invoiceKeys, payInvoice, useInvoice, type Invoice, type PayOption, type Support } from "@/lib/billing/payments";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.billing.invoices;
const MAX_BYTES = 5 * 1024 * 1024;

export function InvoiceView({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useInvoice(id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    setCancelling(true);
    try {
      await cancelInvoice(id);
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(t.cancelled);
      setConfirmCancel(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const { invoice, support } = data;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="no-print mb-2">
        <Link href="/dashboard/billing/invoices">
          <ArrowRight />
          {t.back}
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.invoiceTitle(invoice.number ?? "")}
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        description={formatCairo(invoice.created_at)}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            {invoice.status === "open" ? (
              <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                {t.cancel}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              {t.print}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <StateCard invoice={invoice} />
          {invoice.payments?.length ? <PaymentsCard invoice={invoice} /> : null}
        </div>
        <div className="flex flex-col gap-6">
          <SummaryCard invoice={invoice} />
          {support.email || support.whatsapp ? <SupportCard support={support} /> : null}
        </div>
      </div>

      <ConfirmDialog open={confirmCancel} onOpenChange={setConfirmCancel} title={t.cancel} confirmLabel={t.cancel} destructive loading={cancelling} onConfirm={cancel} />
    </>
  );
}

function SummaryCard({ invoice }: { invoice: Invoice }) {
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className={strong ? "font-bold" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "font-display text-lg font-extrabold tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.summary}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-semibold">{t.plan(invoice.plan.name, invoice.period ? ar.billing.periods[invoice.period] : "")}</p>
        {invoice.days ? <p className="text-xs text-muted-foreground">{t.days(invoice.days)}</p> : null}
        <dl className="mt-3 divide-y text-sm">
          {row(t.subtotal, formatPrice(invoice.subtotal))}
          {invoice.discount > 0 ? row(t.discount, `- ${formatPrice(invoice.discount)}`) : null}
          {invoice.credit > 0 ? row(t.credit, `- ${formatPrice(invoice.credit)}`) : null}
          {row(t.toPay, formatPrice(invoice.total), true)}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{invoice.starts_now ? t.startsNow : t.startsLater}</p>
        {invoice.payable && invoice.expires_at ? <p className="mt-1 text-xs text-muted-foreground">{t.expiresAt(formatCairo(invoice.expires_at))}</p> : null}
      </CardContent>
    </Card>
  );
}

function StateCard({ invoice }: { invoice: Invoice }) {
  if (invoice.payable) return <PayCard invoice={invoice} />;
  return <StatusNotice invoice={invoice} />;
}

function StatusNotice({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const paid = invoice.status === "paid";
  // Paid: refresh the session once so the new plan (limits, banner) shows everywhere.
  useEffect(() => {
    if (paid) router.refresh();
  }, [paid, router]);

  const pending = invoice.status === "pending_review";
  const Icon = paid ? CheckCircle2 : pending ? Clock : XCircle;

  return (
    <Card className="flex items-start gap-4 p-6">
      <Icon className={paid ? "size-8 shrink-0 text-success" : pending ? "size-8 shrink-0 text-warning" : "size-8 shrink-0 text-muted-foreground"} aria-hidden />
      <div>
        <p className="font-display text-lg font-bold">{paid ? t.paidTitle : pending ? t.pendingTitle : t.statuses[invoice.status]}</p>
        <p className="mt-1 text-sm text-muted-foreground">{paid ? t.paidText(formatCairo(invoice.paid_at)) : pending ? t.pendingText : t.closedText}</p>
        {invoice.refunded_at ? <p className="mt-2 text-sm">{t.refundedAt(formatCairo(invoice.refunded_at))}</p> : invoice.refund_requested_at ? <p className="mt-2 text-sm">{t.refundRequested(formatCairo(invoice.refund_requested_at))}</p> : null}
        {!paid && !pending ? (
          <Button className="no-print mt-4" asChild>
            <Link href={PRICING_PATH}>{ar.billing.seePlans}</Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <span dir="ltr" className="flex-1 truncate font-mono font-bold">
          {value}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="no-print"
          onClick={async () => {
            await navigator.clipboard?.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy />
          {copied ? t.copied : t.copy}
        </Button>
      </div>
    </div>
  );
}

const paySchema = z.object({
  method: z.string().min(1, ar.validation.required),
  sender_ref: z.string().trim().min(3, ar.validation.min(3)).max(120),
  receipt: z
    .instanceof(File, { message: ar.validation.required })
    .refine((f) => f.size <= MAX_BYTES, t.receiptHint)
    .refine((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type), t.receiptHint),
});

type PayValues = z.infer<typeof paySchema>;

function PayCard({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient();
  const options = invoice.pay_with ?? [];
  const form = useForm<PayValues>({ resolver: zodResolver(paySchema), defaultValues: { method: options[0]?.key ?? "", sender_ref: "" } });
  const { errors, isSubmitting } = form.formState;
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState(options[0]?.key ?? "");
  const option: PayOption | undefined = options.find((o) => o.key === selected) ?? options[0];

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  async function onSubmit(values: PayValues) {
    const body = new FormData();
    body.set("method", values.method);
    body.set("sender_ref", values.sender_ref);
    body.set("receipt", values.receipt);
    try {
      const updated = await payInvoice(invoice.id, body);
      queryClient.setQueryData(invoiceKeys.one(invoice.id), (old: { invoice: Invoice; support: Support } | undefined) => (old ? { ...old, invoice: updated } : old));
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(t.sent);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["method", "sender_ref", "receipt"]);
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  if (!option) {
    return (
      <Card className="p-6">
        <p className="font-semibold">{t.noMethods}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.howToPay}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {options.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="tablist">
            {options.map((o) => (
              <Button
                key={o.key}
                type="button"
                role="tab"
                aria-selected={o.key === option.key}
                variant={o.key === option.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelected(o.key);
                  form.setValue("method", o.key);
                }}
              >
                {o.name}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {option.account_value ? <CopyField label={option.account_label ?? option.name} value={option.account_value} /> : null}
          <CopyField label={t.amount} value={String(option.amount)} />
          {option.reference ? <CopyField label={t.reference} value={option.reference} /> : null}
        </div>
        {option.instructions ? <p className="text-sm">{option.instructions}</p> : null}
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="no-print flex flex-col gap-4 rounded-xl border p-4">
          <p className="font-bold">{t.uploadTitle}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.method} htmlFor="pay-method" error={errors.method?.message} required>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Select
                    id="pay-method"
                    options={options.map((o) => ({ value: o.key, label: o.name }))}
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setSelected(e.target.value);
                    }}
                  />
                )}
              />
            </FormField>
            <FormField label={t.senderRef} htmlFor="pay-ref" error={errors.sender_ref?.message} required>
              <Input id="pay-ref" dir="ltr" autoComplete="off" {...form.register("sender_ref")} />
            </FormField>
          </div>
          <FormField label={t.receipt} htmlFor="pay-receipt" hint={t.receiptHint} error={errors.receipt?.message} required>
            <Controller
              control={form.control}
              name="receipt"
              render={({ field }) => (
                <label htmlFor="pay-receipt" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-accent">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={preview} alt={t.receipt} className="max-h-56 rounded-lg object-contain" />
                  ) : (
                    <Upload className="size-6" aria-hidden />
                  )}
                  <span>{field.value?.name ?? t.chooseFile}</span>
                  <input
                    id="pay-receipt"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      field.onChange(file);
                      setPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              )}
            />
          </FormField>
          <Button type="submit" loading={isSubmitting} className="self-end">
            {t.send}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentsCard({ invoice }: { invoice: Invoice }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.payments}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {invoice.payments?.map((p) => (
            <li key={p.id} className="rounded-xl border p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.method.name}</span>
                <PaymentStatusBadge status={p.status} />
                <span className="text-xs text-muted-foreground">{formatCairo(p.created_at)}</span>
              </p>
              <p className="mt-1 text-muted-foreground" dir="auto">
                {p.sender_ref} · {formatPrice(p.amount)}
              </p>
              {p.reject_reason ? <p className="mt-1 font-semibold text-destructive">{t.rejectedReason(p.reject_reason)}</p> : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SupportCard({ support }: { support: Support }) {
  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>{t.support}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {support.whatsapp ? (
          <a href={`https://wa.me/${support.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-start font-semibold text-primary hover:underline">
            {ar.legal.whatsapp}: {support.whatsapp}
          </a>
        ) : null}
        {support.email ? (
          <a href={`mailto:${support.email}`} dir="ltr" className="text-start font-semibold text-primary hover:underline">
            {support.email}
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}
