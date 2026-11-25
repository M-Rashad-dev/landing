"use client";

import { FileText, Undo2 } from "lucide-react";
import * as React from "react";
import { FileDrop } from "@/components/forms/inputs";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { cancelRefund, completeRefund, refundProofUrl, type OrderDetail, type Refund } from "./api";
import { RefundDialog } from "./refund-dialog";

const t = ar.refunds.card;
const TONES: Record<Refund["status"], Tone> = { pending: "warning", done: "success", cancelled: "neutral" };

export function RefundStatusBadge({ status }: { status: Refund["status"] }) {
  return <Badge tone={TONES[status]}>{ar.refunds.status[status]}</Badge>;
}

/** Money sent back to the customer: what came in, what went back, «رد مبلغ», and each refund («اترجّع» / «الغي»). */
export function RefundsCard({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const can = useCan();
  const [adding, setAdding] = React.useState(false);
  const r = order.refunds;
  // Nothing collected and nothing ever refunded: the card has nothing to say.
  if (r.collected === 0 && r.list.length === 0) return null;
  const manage = can("orders.refunds");

  return (
    <Panel>
      <PanelHeader
        title={t.title}
        actions={
          manage && r.refundable > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Undo2 />
              {t.add}
            </Button>
          ) : r.state ? (
            <Badge tone={r.state === "full" ? "danger" : "warning"}>{ar.refunds.state[r.state]}</Badge>
          ) : null
        }
      />
      <PanelBody className="flex flex-col gap-3">
        <dl className="grid grid-cols-3 gap-2 text-center text-[13px]">
          <Figure label={t.collected} value={r.collected} />
          <Figure label={t.refunded} value={r.refunded} />
          <Figure label={t.refundable} value={r.refundable} />
        </dl>
        {r.list.length === 0 ? <p className="text-sm text-ink-2">{t.none}</p> : null}
        <ul className="flex flex-col gap-2">
          {r.list.map((refund) => (
            <li key={refund.id}>
              <RefundRow refund={refund} manage={manage} onSaved={onSaved} />
            </li>
          ))}
        </ul>
      </PanelBody>
      <RefundDialog order={order} open={adding} onOpenChange={setAdding} onSaved={onSaved} />
    </Panel>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tabular font-semibold">{formatMoney(value)}</dd>
    </div>
  );
}

export function RefundRow({ refund, manage, onSaved }: { refund: Refund; manage: boolean; onSaved: () => Promise<unknown> }) {
  const [completing, setCompleting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Back through the gateway: nothing to type, the gateway sends it (a confirm first).
  const sendViaGateway = async () => {
    setBusy(true);
    try {
      await completeRefund(refund.id, "", null);
      toast.success(ar.refunds.complete.done);
      setSending(false);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelRefund(refund.id);
      toast.success(t.cancelled);
      setCancelling(false);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular">{formatMoney(refund.amount)}</span>
        <span className="text-ink-2">· {refund.method_label}</span>
        <RefundStatusBadge status={refund.status} />
      </div>
      {refund.items.length > 0 ? <p className="text-xs text-ink-2">{refund.items.map((i) => `${i.product_name ?? "—"} × ${i.quantity}`).join("، ")}</p> : null}
      {refund.reason ? <p className="text-xs text-ink-2">{refund.reason}</p> : null}
      <p className="flex flex-wrap gap-x-3 text-xs text-ink-3">
        {refund.destination ? <span dir="auto">{t.destination(refund.destination)}</span> : null}
        {refund.reference ? <span dir="auto">{t.reference(refund.reference)}</span> : null}
        {refund.done_at ? <span>{t.doneAt(formatDateTime(refund.done_at))}</span> : <span>{formatDateTime(refund.created_at)}</span>}
        {refund.done_by ?? refund.created_by ? <span>{t.by((refund.done_by ?? refund.created_by) as string)}</span> : null}
        {refund.restocked ? <span>{t.restocked}</span> : null}
        {refund.revoke_digital && refund.status === "done" ? <span>{t.revoked}</span> : null}
      </p>
      {refund.has_proof ? (
        <a href={refundProofUrl(refund.id)} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline">
          <FileText className="size-3.5" aria-hidden />
          {t.proof}
        </a>
      ) : null}
      {manage && refund.status === "pending" ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => (refund.method === "gateway" ? setSending(true) : setCompleting(true))}>
            {t.complete}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
            {t.cancel}
          </Button>
        </div>
      ) : null}
      <CompleteRefundDialog refund={refund} open={completing} onOpenChange={setCompleting} onSaved={onSaved} />
      <ConfirmDialog open={sending} onOpenChange={setSending} title={t.sendGatewayTitle(formatMoney(refund.amount))} description={t.sendGatewayText} confirmLabel={ar.refunds.dialog.submitGateway} loading={busy} onConfirm={() => void sendViaGateway()} />
      <ConfirmDialog open={cancelling} onOpenChange={setCancelling} title={t.cancelConfirm} confirmLabel={t.cancel} destructive loading={busy} onConfirm={() => void cancel()} />
    </div>
  );
}

/** «اترجّع»: the money went back (reference and proof optional); the customer gets an email. */
function CompleteRefundDialog({ refund, open, onOpenChange, onSaved }: { refund: Refund; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <CompleteForm refund={refund} onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function CompleteForm({ refund, onOpenChange, onSaved }: { refund: Refund; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  const c = ar.refunds.complete;
  const d = ar.refunds.dialog;
  const [reference, setReference] = React.useState(refund.reference ?? "");
  const [proof, setProof] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await completeRefund(refund.id, reference.trim(), proof);
      toast.success(c.done);
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent size="md">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <DialogHeader title={c.title} description={c.description(`${formatMoney(refund.amount)} · ${refund.method_label}${refund.destination ? ` (${refund.destination})` : ""}`)} />
        <DialogBody className="flex flex-col gap-3">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={d.reference} htmlFor={`refund-ref-${refund.id}`} optional>
            <Input id={`refund-ref-${refund.id}`} dir="ltr" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label={d.proof} hint={d.proofHint} optional>
            <FileDrop accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" file={proof} onFile={setProof} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={busy}>
            {c.submit}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
