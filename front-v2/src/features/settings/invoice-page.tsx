"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { INVOICE_TONES } from "./billing-page";
import { sendReceipt, shownStatus, useInvoice } from "./billing-api";
import { ReceiptForm, Summary } from "./checkout";

const t = ar.settings.invoice;

export function InvoicePage({ id }: { id: number }) {
  const query = useInvoice(id);
  const client = useQueryClient();
  const router = useRouter();
  const [resending, setResending] = React.useState(false);

  if (query.isPending) return <Skeleton className="h-96 max-w-4xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const inv = query.data;
  const status = shownStatus(inv);
  // After a rejection the invoice reopens for a while: another receipt can be sent.
  const canResend = inv.status === "open" && inv.payable;

  return (
    <>
      <PageHeader
        crumbs={[{ label: t.back, href: "/dashboard/settings/billing" }, { label: inv.number ?? "" }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.title(inv.number ?? "")}
            <Badge tone={INVOICE_TONES[status]} dot>
              {ar.settings.billing.invoiceStatus[status]}
            </Badge>
          </span>
        }
        description={formatDateTime(inv.created_at)}
      />
      <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-4">
          {status === "pending_review" ? <Alert tone="info">{t.pendingNote}</Alert> : null}
          {status === "paid" && inv.paid_at ? <Alert tone="success">{t.paidNote(formatDateTime(inv.paid_at))}</Alert> : null}

          <Panel>
            <PanelHeader title={t.payments} />
            <ul className="divide-y divide-border">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.method.name}</span>
                    <Badge tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "attention"} size="sm">
                      {t.status[p.status]}
                    </Badge>
                    <span className="ms-auto font-semibold tabular">{formatMoney(p.amount)}</span>
                  </div>
                  <p className="text-xs text-ink-3">
                    {t.sentAt} {formatDateTime(p.created_at)}
                    {p.sender_ref ? ` · ${p.sender_ref}` : ""}
                  </p>
                  {p.reject_reason ? <p className="text-sm text-danger">{t.rejectReason(p.reject_reason)}</p> : null}
                  <Button asChild size="sm" variant="link" className="self-start">
                    <a href={`/api/bff/dashboard/billing/invoices/${inv.id}/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      {t.viewReceipt}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          {canResend ? (
            resending ? (
              <ReceiptForm
                methods={inv.pay_with ?? []}
                total={inv.total}
                submit={(fields, receipt) => sendReceipt(`/dashboard/billing/invoices/${inv.id}/payments`, fields, receipt)}
                onDone={async () => {
                  toast.success(ar.settings.checkout.sent);
                  setResending(false);
                  await client.invalidateQueries({ queryKey: ["billing"] });
                  router.refresh();
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setResending(true)}>{t.resend}</Button>
                {inv.expires_at ? <span className="text-xs text-ink-3">{t.resendUntil(formatDateTime(inv.expires_at))}</span> : null}
              </div>
            )
          ) : null}
        </div>
        <Summary invoice={inv} />
      </div>
    </>
  );
}
