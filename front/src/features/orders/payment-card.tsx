"use client";

import { Check, CheckCircle2, Clock, Copy, ExternalLink, FileText, X, XCircle } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { OrderDetail, OrderPaymentInfo } from "./api";

const p = ar.orders.payment;

/** A prepaid order: how the customer pays, his receipts, and the merchant's answer (accepting confirms the order). */
export function PaymentCard({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const payment = order.payment;
  const [rejecting, setRejecting] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  if (!payment) return null;
  const pending = payment.receipts.find((r) => r.status === "pending");

  const approve = async (id: number) => {
    setBusy(id);
    try {
      await api(`/dashboard/orders/${order.id}/payments/${id}/approve`, { method: "POST" });
      toast.success(p.approved);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!payment.pay_url) return;
    try {
      await navigator.clipboard.writeText(payment.pay_url);
      toast.success(p.linkCopied);
    } catch {
      toast.error(ar.common.errorTitle);
    }
  };

  return (
    <Panel>
      <PanelHeader title={p.title} description={payment.method_name ? p.method(payment.method_name) : undefined} actions={<StateBadge state={payment.status} />} />
      <PanelBody className="flex flex-col gap-3">
        {payment.status === "paid" && payment.paid_at ? <p className="text-xs text-ink-3">{p.paidAt(formatDateTime(payment.paid_at))}</p> : null}
        {payment.receipts.length === 0 ? <p className="text-sm text-ink-2">{order.status === "awaiting_payment" ? p.noReceipt : p.noReceiptClosed}</p> : null}
        <ul className="flex flex-col gap-2">
          {payment.receipts.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-start gap-3">
                <a href={`/api/bff/dashboard/orders/${order.id}/payments/${r.id}/receipt`} target="_blank" rel="noreferrer" className="shrink-0 overflow-hidden rounded-md border border-border" aria-label={p.openReceipt}>
                  {r.is_pdf ? (
                    <span className="flex size-16 items-center justify-center bg-surface-2 text-ink-3">
                      <FileText className="size-6" aria-hidden />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- the receipt comes through the dashboard API
                    <img src={`/api/bff/dashboard/orders/${order.id}/payments/${r.id}/receipt`} alt="" className="size-16 object-cover" />
                  )}
                </a>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {formatMoney(r.amount)} · {r.method_name}
                    <ReceiptBadge status={r.status} />
                  </p>
                  {r.sender_ref ? <p className="text-xs text-ink-3">{p.sender(r.sender_ref)}</p> : null}
                  <p className="text-xs text-ink-3">{formatDateTime(r.created_at)}</p>
                  {r.reject_reason ? <p className="mt-1 text-xs text-danger">{p.reason(r.reject_reason)}</p> : null}
                  {r.reviewer && r.status !== "pending" ? <p className="text-xs text-ink-3">{p.reviewedBy(r.reviewer)}</p> : null}
                </div>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" loading={busy === r.id} onClick={() => void approve(r.id)}>
                    <Check />
                    {p.approve}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" disabled={busy !== null} onClick={() => setRejecting(r.id)}>
                    <X />
                    {p.reject}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {pending ? <p className="text-xs text-ink-3">{p.checkFirst}</p> : null}
        {order.status === "awaiting_payment" && payment.pay_url ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="ghost" onClick={() => void copyLink()}>
              <Copy />
              {p.copyLink}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={payment.pay_url} target="_blank" rel="noreferrer">
                <ExternalLink />
                {p.openPay}
              </a>
            </Button>
          </div>
        ) : null}
      </PanelBody>
      {/* A fresh dialog (empty reason) for every receipt. */}
      <RejectDialog
        key={rejecting ?? "closed"}
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        onReject={async (reason) => {
          if (rejecting === null) return;
          await api(`/dashboard/orders/${order.id}/payments/${rejecting}/reject`, { method: "POST", body: { reason } });
          toast.success(p.rejected);
          setRejecting(null);
          await onSaved();
        }}
      />
    </Panel>
  );
}

function StateBadge({ state }: { state: OrderPaymentInfo["status"] }) {
  if (state === "paid")
    return (
      <Badge tone="success" dot>
        {p.states.paid}
      </Badge>
    );
  if (state === "review")
    return (
      <Badge tone="attention" dot>
        {p.states.review}
      </Badge>
    );
  return (
    <Badge tone="warning" dot>
      {p.states.unpaid}
    </Badge>
  );
}

function ReceiptBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <Badge size="sm" tone={status === "approved" ? "success" : status === "rejected" ? "danger" : "attention"}>
      <Icon />
      {p.receiptStatus[status]}
    </Badge>
  );
}

function RejectDialog({ open, onClose, onReject }: { open: boolean; onClose: () => void; onReject: (reason: string) => Promise<void> }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) {
      setError(p.reasonRequired);
      return;
    }
    setBusy(true);
    try {
      await onReject(reason.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader title={p.rejectTitle} description={p.rejectHint} />
        <DialogBody>
          <Field label={p.reasonLabel} htmlFor="reject-reason" error={error ?? undefined} required>
            <Textarea id="reject-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={p.reasonPlaceholder} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void submit()}>
            {p.reject}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
