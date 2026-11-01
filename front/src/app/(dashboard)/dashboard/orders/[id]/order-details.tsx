"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, Copy, Pencil, Printer, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorState } from "@/components/dashboard/error-state";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPhoneLocal } from "@/lib/format/phone";
import { GOVERNORATES } from "@/lib/governorates";
import { changeOrderStatus, orderKeys, updateOrder, useOrder, type OrderDetail, type OrderStatus, type OrderUpdate } from "@/lib/orders/api";
import { ContactActions } from "@/components/orders/contact-actions";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.orders;

export function OrderDetails({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { data: order, isPending, isError, error, refetch } = useOrder(id);
  const [transition, setTransition] = useState<{ status: OrderStatus; label: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const store = (next: OrderDetail) => {
    queryClient.setQueryData(orderKeys.detail(id), next);
    void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["orders", "stats"] });
    void queryClient.invalidateQueries({ queryKey: orderKeys.overview });
  };

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !order) return <DetailsSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/orders" className="no-print mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="size-4" aria-hidden />
            {t.back}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tabular-nums">{t.orderTitle(order.order_number)}</h1>
            <OrderStatusBadge status={order.status} />
            {order.is_duplicate_suspect ? (
              <Badge variant="warning" title={t.duplicateHint} className="gap-1">
                <Copy className="size-3" aria-hidden />
                {t.duplicate}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatCairo(order.created_at)}</p>
        </div>
        <Button variant="outline" asChild className="no-print">
          <Link href={`/dashboard/orders/print?ids=${order.id}`}>
            <Printer />
            {t.print}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-bold">{t.customer}</h2>
              <Button variant="ghost" size="sm" className="no-print" onClick={() => setEditing(true)} disabled={!order.can_edit_customer} title={order.can_edit_customer ? undefined : t.editLocked}>
                <Pencil />
                {t.editCustomer}
              </Button>
            </div>
            <p className="text-lg font-bold">{order.customer_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span dir="ltr" className="font-semibold tabular-nums">
                {formatPhoneLocal(order.customer_phone)}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {order.customer_phone2 ? <Info label={t.phone2} value={<span dir="ltr">{formatPhoneLocal(order.customer_phone2)}</span>} /> : null}
              {order.governorate ? <Info label={t.governorate} value={order.governorate} /> : null}
              {order.city ? <Info label={t.city} value={order.city} /> : null}
              {order.address ? <Info label={t.address} value={order.address} className="sm:col-span-2" /> : null}
              {order.notes ? <Info label={t.notes} value={order.notes} className="sm:col-span-2" /> : null}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-bold">{t.product}</h2>
            <ul className="flex flex-col divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 py-2 first:pt-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {item.product_name}
                    {item.is_upsell ? <Badge variant="gold">{t.upsellItem}</Badge> : null}
                    {item.is_gift ? <Badge variant="success">🎁 {t.giftItem}</Badge> : null}
                  </p>
                  {item.options.length > 0 ? <p className="text-sm text-muted-foreground">{item.options.map((o) => `${o.option}: ${o.value}`).join("، ")}</p> : null}
                  <p className="text-sm">
                    {t.quantity}: <span className="font-semibold tabular-nums">{item.quantity}</span> · {t.unitPrice}: <span className="font-semibold">{formatPrice(item.unit_price)}</span>
                  </p>
                </li>
              ))}
            </ul>
            <h3 className="mb-2 mt-5 text-sm font-bold text-muted-foreground">{t.breakdown}</h3>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label={t.subtotal} value={formatPrice(order.subtotal)} />
              {order.offer ? <Row label={t.offerDiscount(order.offer.name)} value={`− ${formatPrice(order.offer.discount)}`} className="text-success" /> : null}
              {order.code ? <Row label={t.codeDiscount(order.code.code)} value={`− ${formatPrice(order.code.discount)}`} className="text-success" /> : null}
              {order.shipping_fee > 0 ? <Row label={t.invoice.shipping} value={formatPrice(order.shipping_fee)} /> : null}
              <div className="mt-1 flex items-center justify-between border-t pt-3 text-base font-extrabold">
                <dt>{t.total}</dt>
                <dd>{formatPrice(order.total)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">{t.cod}</p>
            </dl>
          </Card>

          {order.answers.length > 0 ? (
            <Card className="p-5">
              <h2 className="mb-4 font-bold">{t.answers}</h2>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {order.answers.map((answer) => (
                  <Info key={answer.key} label={answer.label} value={typeof answer.value === "boolean" ? (answer.value ? t.yes : t.no) : String(answer.value)} />
                ))}
              </dl>
            </Card>
          ) : null}

          <InternalNote key={order.internal_note ?? ""} order={order} onSaved={store} />

          <Card className="p-5">
            <h2 className="mb-4 font-bold">{t.timeline}</h2>
            <ol className="relative flex flex-col gap-4 border-s ps-5">
              {[...order.logs.map((log) => ({ kind: "status" as const, at: log.created_at, log })), ...order.events.map((event) => ({ kind: "event" as const, at: event.created_at, event }))]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((entry) =>
                  entry.kind === "status" ? (
                    <li key={`s${entry.log.id}`} className="relative">
                      <span className="absolute -start-[1.6rem] top-1 size-3 rounded-full border-2 border-card bg-primary" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2">
                        <OrderStatusBadge status={entry.log.to_status} />
                        <span className="text-xs text-muted-foreground">{formatCairo(entry.log.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.log.from_status === null ? t.createdBy : entry.log.user ? t.by(entry.log.user.name) : t.system}</p>
                      {entry.log.note ? <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm">{entry.log.note}</p> : null}
                    </li>
                  ) : (
                    <li key={`e${entry.event.id}`} className="relative">
                      <span className={cn("absolute -start-[1.6rem] top-1 size-3 rounded-full border-2 border-card", entry.event.type === "whatsapp" ? "bg-success" : "bg-gold")} aria-hidden />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{t.contact.events[entry.event.type]}</span>
                        <span className="text-xs text-muted-foreground">{formatCairo(entry.event.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.event.user ? t.by(entry.event.user.name) : t.system}
                        {entry.event.follow_up_at ? ` · ${t.contact.nextCall(formatCairo(entry.event.follow_up_at))}` : ""}
                      </p>
                      {entry.event.note ? <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm">{entry.event.note}</p> : null}
                    </li>
                  ),
                )}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className={cn("no-print p-5", order.status === "new" && "border-gold/50 bg-gold-soft/40")}>
            <h2 className="mb-3 font-bold">{t.contact.title}</h2>
            <ContactActions order={order} onChange={(updated) => store(updated)} />
          </Card>

          <Card className="no-print p-5">
            <h2 className="mb-3 font-bold">{t.actions}</h2>
            {order.allowed_transitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noActions}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {order.allowed_transitions.map((next) => (
                  <Button key={next.status} variant={next.status === "fake" || next.status === "cancelled" ? "outline" : "default"} className={cn("justify-start", next.status === "fake" && "text-destructive")} onClick={() => setTransition(next)}>
                    {t.changeTo(next.label)}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <CustomerHistory order={order} />

          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-bold">{t.source}</h2>
            <dl className="flex flex-col gap-2">
              {order.page ? <Info label={t.page} value={order.page.title} /> : null}
              {order.utm
                ? Object.entries(order.utm).map(([key, value]) => <Info key={key} label={key} value={<span dir="ltr" className="break-all">{value}</span>} />)
                : null}
              {order.ip_address ? <Info label="IP" value={<span dir="ltr">{order.ip_address}</span>} /> : null}
            </dl>
          </Card>
        </div>
      </div>

      {transition ? <TransitionDialog key={transition.status} order={order} target={transition} onClose={() => setTransition(null)} onDone={store} /> : null}
      {editing ? <EditCustomerDialog order={order} onClose={() => setEditing(false)} onSaved={store} /> : null}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line font-medium">{value}</dd>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <dt>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CustomerHistory({ order }: { order: OrderDetail }) {
  const history = order.customer_history;
  return (
    <Card className="p-5 text-sm">
      <h2 className="mb-3 font-bold">{t.history}</h2>
      {history.phone_blocked || history.ip_blocked ? (
        <div className="mb-3 flex flex-col gap-1">
          {history.phone_blocked ? (
            <Badge variant="destructive" className="w-fit gap-1">
              <Ban className="size-3" aria-hidden />
              {t.phoneBlocked}
            </Badge>
          ) : null}
          {history.ip_blocked ? (
            <Badge variant="destructive" className="w-fit gap-1">
              <Ban className="size-3" aria-hidden />
              {t.ipBlocked}
            </Badge>
          ) : null}
        </div>
      ) : null}
      {history.total === 0 ? (
        <p className="text-muted-foreground">{t.historyEmpty}</p>
      ) : (
        <>
          <p className="font-semibold">{t.historyTotal(history.total)}</p>
          {history.bad_ratio > 0 ? (
            <p className={cn("mt-1 flex items-center gap-1", history.bad_ratio >= 50 ? "text-destructive" : "text-warning")}>
              <ShieldAlert className="size-4" aria-hidden />
              {t.badRatio(history.bad_ratio)}
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {history.orders.map((other) => (
              <li key={other.id}>
                <Link href={`/dashboard/orders/${other.id}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 hover:bg-accent">
                  <span className="font-semibold tabular-nums">#{other.order_number}</span>
                  <OrderStatusBadge status={other.status} />
                  <span className="text-xs text-muted-foreground">{formatPrice(other.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function InternalNote({ order, onSaved }: { order: OrderDetail; onSaved: (o: OrderDetail) => void }) {
  const [note, setNote] = useState(order.internal_note ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = note.trim() !== (order.internal_note ?? "");

  async function save() {
    setBusy(true);
    try {
      onSaved(await updateOrder(order.id, { internal_note: note.trim() || null }));
      toast.success(t.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="no-print p-5">
      <FormField label={t.internalNote} htmlFor="internal_note" hint={t.internalNoteHint}>
        <Textarea id="internal_note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty} loading={busy}>
          {t.saveNote}
        </Button>
      </div>
    </Card>
  );
}

function TransitionDialog({ order, target, onClose, onDone }: { order: OrderDetail; target: { status: OrderStatus; label: string } | null; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const [note, setNote] = useState("");
  const [blockPhone, setBlockPhone] = useState(false);
  const [blockIp, setBlockIp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      const fake = target.status === "fake";
      onDone(await changeOrderStatus(order.id, { status: target.status, note: note.trim() || null, block_phone: fake && blockPhone, block_ip: fake && blockIp }));
      toast.success(t.changed);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{target ? t.changeTo(target.label) : ""}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label={t.note} htmlFor="transition_note" optional>
            <Textarea id="transition_note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          {target?.status === "fake" ? (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={blockPhone} onCheckedChange={(v) => setBlockPhone(v === true)} />
                {t.blockPhone} <span dir="ltr" className="text-muted-foreground">({formatPhoneLocal(order.customer_phone)})</span>
              </label>
              {order.ip_address ? (
                <label className="flex items-center gap-2">
                  <Checkbox checked={blockIp} onCheckedChange={(v) => setBlockIp(v === true)} />
                  {t.blockIp} <span dir="ltr" className="text-muted-foreground">({order.ip_address})</span>
                </label>
              ) : null}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {ar.common.cancel}
          </Button>
          <Button variant={target?.status === "fake" ? "destructive" : "default"} onClick={confirm} loading={busy}>
            {ar.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCustomerDialog({ order, onClose, onSaved }: { order: OrderDetail; onClose: () => void; onSaved: (o: OrderDetail) => void }) {
  const [values, setValues] = useState<Required<Omit<OrderUpdate, "internal_note">>>({
    customer_name: order.customer_name,
    customer_phone: formatPhoneLocal(order.customer_phone).replace(/\s/g, ""),
    customer_phone2: order.customer_phone2 ? formatPhoneLocal(order.customer_phone2).replace(/\s/g, "") : "",
    governorate: order.governorate ?? "",
    city: order.city ?? "",
    address: order.address ?? "",
    notes: order.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      onSaved(await updateOrder(order.id, values));
      toast.success(t.saved);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0] ?? ""])));
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.editCustomer}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={ar.orders.columns.customer} htmlFor="e_name" error={errors.customer_name} required className="sm:col-span-2">
            <Input id="e_name" value={values.customer_name ?? ""} onChange={set("customer_name")} maxLength={80} />
          </FormField>
          <FormField label={t.columns.phone} htmlFor="e_phone" error={errors.customer_phone} required>
            <Input id="e_phone" dir="ltr" inputMode="tel" value={values.customer_phone ?? ""} onChange={set("customer_phone")} />
          </FormField>
          <FormField label={t.phone2} htmlFor="e_phone2" error={errors.customer_phone2} optional>
            <Input id="e_phone2" dir="ltr" inputMode="tel" value={values.customer_phone2 ?? ""} onChange={set("customer_phone2")} />
          </FormField>
          <FormField label={t.governorate} htmlFor="e_gov" error={errors.governorate} optional>
            <Select id="e_gov" value={values.governorate ?? ""} onChange={set("governorate")} placeholder="—" options={GOVERNORATES.map((g) => ({ value: g, label: g }))} />
          </FormField>
          <FormField label={t.city} htmlFor="e_city" error={errors.city} optional>
            <Input id="e_city" value={values.city ?? ""} onChange={set("city")} maxLength={100} />
          </FormField>
          <FormField label={t.address} htmlFor="e_address" error={errors.address} optional className="sm:col-span-2">
            <Textarea id="e_address" rows={2} value={values.address ?? ""} onChange={set("address")} maxLength={300} />
          </FormField>
          <FormField label={t.notes} htmlFor="e_notes" error={errors.notes} optional className="sm:col-span-2">
            <Textarea id="e_notes" rows={2} value={values.notes ?? ""} onChange={set("notes")} maxLength={500} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {ar.common.cancel}
          </Button>
          <Button onClick={save} loading={busy}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-56" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
