"use client";

import { CheckCircle2, Clock, Plus, Send } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { OrderDelivery, OrderDetail } from "./api";

const d = ar.orders.deliveries;

/** What each digital line delivered: codes sent, downloads used, a service to finish; send again, give more. */
export function DeliveriesCard({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [service, setService] = React.useState<OrderDelivery | null>(null);
  const deliveries = order.deliveries ?? [];
  const digitalItems = order.items.filter((i) => i.delivery_type);
  if (deliveries.length === 0 && digitalItems.length === 0) return null;

  const run = async (id: string, path: string, body?: unknown, done?: string) => {
    setBusy(id);
    try {
      await api(path, { method: "POST", body });
      if (done) toast.success(done);
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const nameOf = (delivery: OrderDelivery) => order.items.find((i) => i.id === delivery.order_item_id)?.product_name ?? "";

  return (
    <Panel>
      <PanelHeader title={d.title} description={deliveries.length === 0 ? d.afterPayment : undefined} />
      {deliveries.length > 0 ? (
        <PanelBody className="flex flex-col gap-3">
          {deliveries.map((x) => {
            const done = x.status === "delivered";
            const limit = x.limit === null ? null : x.limit + x.bonus;
            return (
              <div key={x.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{nameOf(x)}</span>
                  <Badge tone={done ? "success" : "warning"} size="sm">
                    {done ? <CheckCircle2 /> : <Clock />}
                    {done ? d.delivered : x.type === "services" ? d.serviceWaiting : d.codesWaiting}
                  </Badge>
                </div>
                <p className="text-xs text-ink-3">
                  {d.types[x.type]}
                  {x.emailed_at ? ` · ${d.emailedAt(formatDateTime(x.emailed_at))}` : ""}
                </p>
                {x.codes.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {x.codes.map((c, i) => (
                      <li key={i} className="whitespace-pre-wrap break-all rounded bg-surface-2 px-2 py-1 font-mono text-xs" dir="ltr">
                        {c}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {x.type === "files"
                  ? x.files.map((f) => (
                      <p key={f.id} className="flex justify-between gap-2 text-xs">
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 tabular text-ink-3">{d.used(x.usage[String(f.id)] ?? 0, limit)}</span>
                      </p>
                    ))
                  : null}
                {x.type === "links" ? <p className="text-xs text-ink-3">{d.opened(x.usage.link ?? 0, limit)}</p> : null}
                {x.type === "services" && done && x.message ? <p className="whitespace-pre-line rounded bg-surface-2 p-2 text-xs">{x.message}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {x.type === "services" && !done ? (
                    <Button size="sm" onClick={() => setService(x)}>
                      <CheckCircle2 />
                      {d.complete}
                    </Button>
                  ) : null}
                  {done ? (
                    <Button size="sm" variant="outline" loading={busy === `resend-${x.id}`} onClick={() => void run(`resend-${x.id}`, `/dashboard/orders/${order.id}/deliveries/${x.id}/resend`, undefined, d.resent)}>
                      <Send />
                      {d.resend}
                    </Button>
                  ) : null}
                  {done && limit !== null ? (
                    <Button size="sm" variant="ghost" loading={busy === `grant-${x.id}`} onClick={() => void run(`grant-${x.id}`, `/dashboard/orders/${order.id}/deliveries/${x.id}/grant`, { count: 1 }, d.granted)}>
                      <Plus />
                      {x.type === "links" ? d.grantOpen : d.grantDownload}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </PanelBody>
      ) : null}
      <ServiceDialog
        key={service?.id ?? "closed"}
        delivery={service}
        order={order}
        productName={service ? nameOf(service) : ""}
        onClose={() => setService(null)}
        onDone={async () => {
          setService(null);
          toast.success(d.completed);
          await onSaved();
        }}
      />
    </Panel>
  );
}

function ServiceDialog({ delivery, order, productName, onClose, onDone }: { delivery: OrderDelivery | null; order: OrderDetail; productName: string; onClose: () => void; onDone: () => Promise<void> }) {
  const fill = (text: string) => text.replaceAll("{name}", order.customer_name).replaceAll("{order}", String(order.order_number)).replaceAll("{product}", productName).replaceAll("{store}", "");
  const [subject, setSubject] = React.useState(() => fill(delivery?.default_subject || d.defaultSubject));
  const [message, setMessage] = React.useState(() => fill(delivery?.default_message || d.defaultMessage));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (!delivery) return;
    if (!subject.trim() || message.trim().length < 2) return setError(d.messageRequired);
    setBusy(true);
    try {
      await api(`/dashboard/orders/${order.id}/deliveries/${delivery.id}/complete`, { method: "POST", body: { subject: subject.trim(), message: message.trim() } });
      await onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={delivery !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader title={d.completeTitle} description={d.completeHint} />
        <DialogBody className="flex flex-col gap-3">
          <Field label={d.subject} htmlFor="svc-subject">
            <Input id="svc-subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label={d.message} htmlFor="svc-message" error={error ?? undefined}>
            <Textarea id="svc-message" rows={5} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            <Send />
            {d.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
