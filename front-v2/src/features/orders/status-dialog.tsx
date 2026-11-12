"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCards } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { bulkStatus, changeStatus, type OrderDetail, type OrderStatus } from "./api";

const t = ar.orders.status;
const RESTOCKS: OrderStatus[] = ["returned", "cancelled", "fake"];

/**
 * Change one order (or several) to one of the allowed next statuses, with an optional note,
 * a tracking number when shipping, and blocking when marking fake.
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: OrderStatus[];
  ids: number[];
  initial?: OrderStatus;
  onDone: (order?: OrderDetail) => void | Promise<unknown>;
};

export function StatusDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Mounted on open: every opening starts clean. */}
      {props.open ? <StatusForm {...props} /> : null}
    </Dialog>
  );
}

function StatusForm({ onOpenChange, targets, ids, initial, onDone }: Props) {
  const [to, setTo] = React.useState<OrderStatus | "">(initial ?? targets[0] ?? "");
  const [note, setNote] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [blockPhone, setBlockPhone] = React.useState(false);
  const [blockIp, setBlockIp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const single = ids.length === 1;

  async function submit() {
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      if (single) {
        const order = await changeStatus(ids[0], {
          status: to,
          note: note.trim() || undefined,
          tracking_number: to === "shipped" ? tracking.trim() || undefined : undefined,
          block_phone: to === "fake" ? blockPhone : undefined,
          block_ip: to === "fake" ? blockIp : undefined,
        });
        toast.success(t.changed(ar.domain.orderStatus[to]));
        await onDone(order);
      } else {
        const result = await bulkStatus(ids, to, note.trim() || undefined);
        if (result.failed > 0) toast.warning(ar.orders.bulk.done(result.succeeded, result.failed));
        else toast.success(ar.orders.bulk.done(result.succeeded, 0));
        await onDone();
      }
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent size="md">
      <DialogHeader title={t.change} description={single ? undefined : ar.orders.bulk.selected(ids.length)} />
      <DialogBody className="flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {targets.length === 0 ? (
          <p className="text-sm text-ink-2">{t.none}</p>
        ) : (
          <Field label={t.to}>
            <RadioCards
              value={to}
              onValueChange={(v) => setTo(v as OrderStatus)}
              options={targets.map((s) => ({
                value: s,
                title: ar.domain.orderStatus[s],
              }))}
            />
          </Field>
        )}
        {to && RESTOCKS.includes(to) ? <p className="text-xs text-ink-3">{t.restockHint}</p> : null}
        {to === "damaged" ? <p className="text-xs text-ink-3">{t.damagedHint}</p> : null}
        {to === "shipped" && single ? (
          <Field label={t.tracking} htmlFor="status-tracking" hint={t.trackingHint} optional>
            <Input id="status-tracking" dir="ltr" maxLength={60} value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t.note} htmlFor="status-note" hint={t.noteHint} optional>
          <Textarea id="status-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {to === "fake" && single ? (
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={blockPhone} onCheckedChange={(v) => setBlockPhone(v === true)} />
              {t.blockPhone}
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={blockIp} onCheckedChange={(v) => setBlockIp(v === true)} />
              {t.blockIp}
            </label>
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {ar.common.cancel}
        </Button>
        <Button disabled={!to || targets.length === 0} loading={busy} onClick={() => void submit()}>
          {ar.common.confirm}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
