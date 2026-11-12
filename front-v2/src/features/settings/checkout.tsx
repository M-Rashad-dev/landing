"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { FileDrop } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { IMAGE_ACCEPT, ImageRejected, prepareImage } from "@/lib/media/compress";
import { ar } from "@/messages/ar";
import { sendReceipt, usePreview, type Invoice, type PayMethod, type Period } from "./billing-api";

const t = ar.settings.checkout;

export function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const plan = params.get("plan") ?? "";
  const period: Period = params.get("period") === "yearly" ? "yearly" : "monthly";
  const query = usePreview(plan, period);

  async function done(invoice: Invoice) {
    toast.success(t.sent);
    await client.invalidateQueries({ queryKey: ["billing"] });
    router.push(invoice.id ? `/dashboard/settings/billing/invoices/${invoice.id}` : "/dashboard/settings/billing");
    router.refresh();
  }

  return (
    <>
      <PageHeader crumbs={[{ label: ar.settings.billing.title, href: "/dashboard/settings/billing" }, { label: t.title }]} title={t.title} />
      {query.isPending ? (
        <Skeleton className="h-96 max-w-3xl rounded-xl" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-[1fr_18rem]">
          <ReceiptForm
            methods={query.data.pay_with ?? []}
            total={query.data.total}
            submit={(fields, receipt) => sendReceipt("/dashboard/billing/checkout", { type: "subscription", plan_key: plan, period, ...fields }, receipt)}
            onDone={done}
          />
          <Summary invoice={query.data} />
        </div>
      )}
    </>
  );
}

export function Summary({ invoice }: { invoice: Invoice }) {
  const periodLabel = invoice.period === "yearly" ? ar.settings.billing.yearly : ar.settings.billing.monthly;
  return (
    <Panel>
      <PanelHeader title={t.item} description={invoice.theme ? invoice.theme.name : t.plan(invoice.plan.name, periodLabel)} />
      <PanelBody>
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label={t.subtotal} value={formatMoney(invoice.subtotal)} />
          {invoice.discount > 0 ? <Row label={t.discount} value={`− ${formatMoney(invoice.discount)}`} /> : null}
          {invoice.credit > 0 ? <Row label={t.credit} value={`− ${formatMoney(invoice.credit)}`} /> : null}
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
            <dt>{t.total}</dt>
            <dd className="tabular">{formatMoney(invoice.total)}</dd>
          </div>
        </dl>
      </PanelBody>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

/** Choose how to pay, see where to transfer, attach the receipt (compressed in the browser) and send. */
export function ReceiptForm({
  methods,
  total,
  submit,
  onDone,
}: {
  methods: PayMethod[];
  total: number;
  submit: (fields: Record<string, string>, receipt: File | null) => Promise<Invoice>;
  onDone: (invoice: Invoice) => void | Promise<void>;
}) {
  const manual = methods.filter((m) => m.kind === "manual");
  const [method, setMethod] = React.useState(manual[0]?.key ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [ref, setRef] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const chosen = manual.find((m) => m.key === method);
  const free = total <= 0;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ar.common.copied);
    } catch {
      toast.error(ar.errors.generic);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const receipt = free || !file ? null : await prepareImage(file);
      const fields: Record<string, string> = free ? {} : { method, ...(ref.trim() ? { sender_ref: ref.trim() } : {}) };
      await onDone(await submit(fields, receipt));
    } catch (e) {
      if (e instanceof ImageRejected) setError(e.reason === "type" ? ar.media.rejectedType(e.fileName) : ar.media.rejectedSize(e.fileName));
      else setError(isApiError(e) && e.isValidation ? (Object.values(e.errors)[0]?.[0] ?? errorMessage(e)) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (free) {
    return (
      <Panel>
        <PanelBody className="flex flex-col gap-3">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <p className="text-sm">{t.nothingDue}</p>
          <Button className="self-start" loading={busy} onClick={() => void send()}>
            {t.activate}
          </Button>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader title={t.method} />
      <PanelBody className="flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {manual.length === 0 ? (
          <Alert tone="warning">{t.noMethods}</Alert>
        ) : (
          <>
            <RadioCards value={method} onValueChange={setMethod} options={manual.map((m) => ({ value: m.key, title: m.name }))} />
            {chosen ? (
              <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 text-sm">
                {chosen.account_value ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-2">{chosen.account_label ?? t.transferTo}:</span>
                    <span dir="ltr" className="font-mono font-semibold">
                      {chosen.account_value}
                    </span>
                    <Button size="icon-sm" variant="ghost" aria-label={ar.common.copy} onClick={() => void copy(chosen.account_value!)}>
                      <Copy />
                    </Button>
                  </p>
                ) : null}
                {chosen.reference ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-2">{t.reference}:</span>
                    <span dir="ltr" className="font-mono font-semibold">
                      {chosen.reference}
                    </span>
                    <Button size="icon-sm" variant="ghost" aria-label={ar.common.copy} onClick={() => void copy(chosen.reference!)}>
                      <Copy />
                    </Button>
                  </p>
                ) : null}
                <p className="font-semibold">
                  {t.total}: {formatMoney(chosen.amount)}
                </p>
                {chosen.instructions ? <p className="text-ink-2">{chosen.instructions}</p> : null}
              </div>
            ) : null}
            <Field label={t.receipt} hint={t.receiptHint} required>
              <FileDrop accept={IMAGE_ACCEPT} file={file} onFile={setFile} />
            </Field>
            <Field label={t.senderRef} htmlFor="pay-ref" hint={t.senderRefHint} optional>
              <Input id="pay-ref" dir="ltr" maxLength={120} value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
            <Button className="self-start" loading={busy} disabled={!file || !method} onClick={() => void send()}>
              {t.send}
            </Button>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
