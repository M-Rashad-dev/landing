"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, Printer, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { MoneyInput } from "@/components/forms/inputs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { carrierKeys, cancelShipment, labelsUrl, refreshShipment, shipOrder, stateTone, useCarriers, useShipPrepare, type Shipment } from "@/features/shipping/carriers-api";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import { updateOrder, type OrderDetail } from "./api";

const t = ar.carriers;
const d = ar.orders.detail;

/**
 * «الشحن» on the order page: the shipment through a connected carrier (where it is, its airway bill, cancel), the
 * «اشحن مع …» button for a confirmed order, and the tracking number typed by hand when the store ships itself.
 */
export function ShippingCard({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const carriers = useCarriers();
  const [shipping, setShipping] = React.useState(false);
  const shipment = order.shipment && order.shipment.state !== "cancelled" ? order.shipment : null;
  const connected = (carriers.data ?? []).filter((c) => c.account?.status === "active");

  return (
    <Panel>
      <PanelHeader title={d.shipping_} />
      <PanelBody className="flex flex-col gap-3">
        {order.shipping.company ? (
          <p className="flex items-center gap-2 text-sm">
            <Truck className="size-4 text-ink-3" />
            {order.shipping.company.name}
          </p>
        ) : null}
        {shipment ? (
          <ShipmentBox shipment={shipment} onChanged={onSaved} />
        ) : (
          <>
            {carriers.isPending ? (
              <Skeleton className="h-9 rounded-md" />
            ) : connected.length > 0 ? (
              order.status === "confirmed" ? (
                <Button onClick={() => setShipping(true)}>
                  <Truck />
                  {t.ship.button(connected.length === 1 ? connected[0].name : t.ship.carrier)}
                </Button>
              ) : order.status === "new" ? (
                <p className="text-xs text-ink-3">{t.ship.notConfirmed}</p>
              ) : null
            ) : (
              <p className="text-xs text-ink-3">
                {t.ship.noCarrier}{" "}
                <Link href="/dashboard/shipping" className="font-medium text-brand-strong hover:underline">
                  {t.ship.connectLink}
                </Link>
              </p>
            )}
            <ManualTracking order={order} onSaved={onSaved} />
          </>
        )}
      </PanelBody>
      <ShipDialog open={shipping} order={order} onClose={() => setShipping(false)} onShipped={onSaved} />
    </Panel>
  );
}

function ManualTracking({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const [tracking, setTracking] = React.useState(order.shipping.tracking_number ?? "");
  const [busy, setBusy] = React.useState(false);
  const dirty = tracking.trim() !== (order.shipping.tracking_number ?? "");

  async function save() {
    setBusy(true);
    try {
      await updateOrder(order.id, { tracking_number: tracking.trim() || null });
      toast.success(d.trackingSaved);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={d.trackingNumber} htmlFor="order-tracking">
      <div className="flex gap-2">
        <Input id="order-tracking" dir="ltr" maxLength={60} placeholder={d.trackingPlaceholder} value={tracking} onChange={(e) => setTracking(e.target.value)} />
        {dirty ? (
          <Button size="sm" loading={busy} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

function ShipmentBox({ shipment, onChanged }: { shipment: Shipment; onChanged: () => Promise<unknown> }) {
  const s = t.shipment;
  const [busy, setBusy] = React.useState<"refresh" | "cancel" | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  async function refresh() {
    setBusy("refresh");
    try {
      await refreshShipment(shipment.id);
      toast.success(s.refreshed);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    try {
      await cancelShipment(shipment.id);
      toast.success(s.cancelled);
      setCancelling(false);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
      setCancelling(false);
    } finally {
      setBusy(null);
    }
  }

  const events = [...(shipment.events ?? [])].reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{shipment.carrier_name}</span>
        <Badge tone={stateTone(shipment.state)} dot>
          {shipment.state_label}
        </Badge>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
        <span className="text-ink-3">{s.tracking}</span>
        <span dir="ltr" className="font-semibold tabular">
          {shipment.tracking_number}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ms-auto"
          aria-label={ar.common.copy}
          onClick={() => void navigator.clipboard.writeText(shipment.tracking_number).then(() => toast.success(ar.common.copied))}
        >
          <Copy />
        </Button>
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-ink-3">
        <span>{s.cod(shipment.cod)}</span>
        {shipment.attempts > 0 ? <span>{s.attempts(shipment.attempts)}</span> : null}
      </p>
      {shipment.exception ? <Alert tone="warning">{shipment.exception}</Alert> : null}
      {!shipment.connected ? <Alert tone="info">{s.disconnected}</Alert> : null}
      {shipment.is_open && shipment.connected ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={labelsUrl({ shipmentIds: [shipment.id] })} target="_blank" rel="noopener">
              <Printer />
              {s.label}
            </a>
          </Button>
          <Button size="sm" variant="outline" loading={busy === "refresh"} onClick={() => void refresh()}>
            <RefreshCw />
            {s.refresh}
          </Button>
          {shipment.can_cancel ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelling(true)}>
              <Ban />
              {s.cancel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {events.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-2">{s.timeline}</p>
          <ol className="flex flex-col gap-2 border-s border-border ps-3">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="text-xs">
                <span className="font-medium text-ink">{e.state_label}</span>
                {e.note ? <span className="text-ink-2"> — {e.note}</span> : null}
                <span className="block text-ink-3">{formatDateTime(e.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <ConfirmDialog open={cancelling} onOpenChange={setCancelling} title={s.cancelTitle} description={s.cancelText} confirmLabel={s.cancel} destructive loading={busy === "cancel"} onConfirm={() => void cancel()} />
    </div>
  );
}

function ShipDialog({ open, order, onClose, onShipped }: { open: boolean; order: OrderDetail; onClose: () => void; onShipped: () => Promise<unknown> }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">{open ? <ShipForm order={order} onClose={onClose} onShipped={onShipped} /> : null}</DialogContent>
    </Dialog>
  );
}

function ShipForm({ order, onClose, onShipped }: { order: OrderDetail; onClose: () => void; onShipped: () => Promise<unknown> }) {
  const s = t.ship;
  const client = useQueryClient();
  const [carrier, setCarrier] = React.useState<string | null>(null);
  const prepare = useShipPrepare(order.id, true, carrier);
  const data = prepare.data;
  const chosen = carrier ?? data?.default_carrier ?? data?.carriers[0]?.carrier ?? "";
  const account = data?.carriers.find((c) => c.carrier === chosen)?.account;
  const [district, setDistrict] = React.useState("");
  const [changing, setChanging] = React.useState(false);
  const [cod, setCod] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [allowOpen, setAllowOpen] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const matched = data?.area.matched ?? null;
  const needsPick = !matched || changing;

  async function submit() {
    if (!data) return;
    if (needsPick && !district) {
      setError(s.areaNeeded);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const shipment = await shipOrder(order.id, {
        carrier: chosen,
        district_id: needsPick ? district : null,
        cod: cod ?? String(data.cod),
        items_count: Number(items ?? data.items_count) || null,
        notes: notes.trim() || null,
        allow_open: allowOpen ?? account?.settings.allow_open ?? false,
      });
      toast.success(s.done(shipment.tracking_number), { action: { label: t.shipment.label, onClick: () => window.open(labelsUrl({ shipmentIds: [shipment.id] }), "_blank", "noopener") } });
      await Promise.all([onShipped(), client.invalidateQueries({ queryKey: carrierKeys.all })]);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader title={s.title} description={`#${order.order_number} · ${[order.governorate, order.city].filter(Boolean).join(" · ")}`} />
      <DialogBody className="flex flex-col gap-4">
        {prepare.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ) : prepare.isError || !data ? (
          <Alert tone="danger">{errorMessage(prepare.error)}</Alert>
        ) : (
          <>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {data.carriers.length > 1 ? (
              <Field label={s.carrier}>
                <Select value={chosen} onValueChange={(v) => (setCarrier(v), setDistrict(""), setChanging(false))} options={data.carriers.map((c) => ({ value: c.carrier, label: c.name }))} aria-label={s.carrier} />
              </Field>
            ) : null}
            <Field label={s.area}>
              {data.area.error ? (
                <Alert tone="warning">{data.area.error}</Alert>
              ) : !needsPick ? (
                <p className="flex items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                  {s.areaMatched}
                  <button type="button" className="text-xs font-semibold underline" onClick={() => setChanging(true)}>
                    {s.areaChange}
                  </button>
                </p>
              ) : (
                <Select value={district} onValueChange={setDistrict} placeholder={s.areaPick} searchable options={data.area.districts.map((a) => ({ value: a.id, label: a.name }))} aria-label={s.area} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.cod} hint={s.codHint} htmlFor="ship-cod">
                <MoneyInput id="ship-cod" value={cod ?? String(data.cod)} onChange={setCod} />
              </Field>
              <Field label={s.items} htmlFor="ship-items">
                <Input id="ship-items" type="number" dir="ltr" min={1} max={999} value={items ?? String(data.items_count)} onChange={(e) => setItems(e.target.value)} />
              </Field>
            </div>
            <Field label={s.notes} htmlFor="ship-notes">
              <Input id="ship-notes" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <SwitchRow title={s.allowOpen} checked={allowOpen ?? account?.settings.allow_open ?? false} onCheckedChange={setAllowOpen} />
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {ar.common.cancel}
        </Button>
        <Button loading={busy} disabled={!data || !!data.area.error} onClick={() => void submit()}>
          <Truck />
          {s.submit}
        </Button>
      </DialogFooter>
    </>
  );
}
