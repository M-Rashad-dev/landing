"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, Ban, Gift, MessageCircle, Pencil, Phone, PhoneOff, Printer, Truck, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DescriptionList, Timeline, type TimelineEvent } from "@/components/data/details";
import { OrderSourceTag, OrderStatusBadge } from "@/components/domain/order-status";
import { DatePicker } from "@/components/forms/date-pickers";
import { PhoneInput } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useShipping } from "@/features/shipping/api";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { zPhone, zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { recordContact, updateOrder, useOrder, useRefreshOrders, whatsappLink, type OrderDetail } from "./api";
import { confirmMessage } from "./order-quick-view";
import { StatusDialog } from "./status-dialog";

const t = ar.orders;
const d = t.detail;

export function OrderPage({ id }: { id: number }) {
  const session = useSession();
  const query = useOrder(id);
  const refresh = useRefreshOrders();
  const [changing, setChanging] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;

  const order = query.data;
  const store = session.store_name ?? session.tenant?.name ?? "";

  return (
    <>
      <PageHeader
        crumbs={[{ label: d.back, href: "/dashboard/orders" }, { label: `#${order.order_number}` }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {d.title(order.order_number)}
            <OrderStatusBadge status={order.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateTime(order.created_at)}
            <OrderSourceTag source={order.source} page={order.page} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={whatsappLink(order.customer_phone, confirmMessage(order, store))} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                {t.whatsapp}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/orders/${order.id}/invoice`} target="_blank">
                <Printer />
                {d.print}
              </Link>
            </Button>
            <Button onClick={() => setChanging(true)} disabled={order.allowed_transitions.length === 0}>
              <ArrowLeftRight />
              {t.status.change}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <Items order={order} />
          {order.status === "new" ? <Contact order={order} onSaved={refresh} /> : null}
          <Panel>
            <PanelHeader title={d.timeline} />
            <PanelBody>
              <Timeline events={timeline(order)} />
            </PanelBody>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <CustomerCard order={order} onEdit={() => setEditing(true)} />
          <ShippingCard order={order} onSaved={refresh} />
          <InternalNote order={order} onSaved={refresh} />
        </div>
      </div>

      <StatusDialog open={changing} onOpenChange={setChanging} targets={order.allowed_transitions.map((x) => x.status)} ids={[order.id]} onDone={() => refresh()} />
      <CustomerDialog order={order} open={editing} onOpenChange={setEditing} onSaved={refresh} />
    </>
  );
}

function Items({ order }: { order: OrderDetail }) {
  const rows: Array<{ label: string; value: string; tone?: string }> = [
    { label: d.subtotal, value: formatMoney(order.subtotal) },
    ...(order.offer
      ? [
          {
            label: d.offer(order.offer.name),
            // A gift offer takes nothing off: its product is a line of its own.
            value: order.offer.discount > 0 ? `− ${formatMoney(order.offer.discount)}` : d.gift,
            tone: "text-success",
          },
        ]
      : []),
    ...(order.code
      ? [
          {
            label: d.code(order.code.code),
            value: `− ${formatMoney(order.code.discount)}`,
            tone: "text-success",
          },
        ]
      : []),
    {
      label: [d.shipping, order.shipping.company ? d.shippingWith(order.shipping.company.name) : null, order.shipping.offer ? `(${order.shipping.offer})` : null].filter(Boolean).join(" "),
      value: order.shipping_fee === 0 && order.shipping.discount > 0 ? d.shippingFree : formatMoney(order.shipping_fee),
    },
  ];
  return (
    <Panel>
      <PanelHeader title={d.items} />
      <ul className="divide-y divide-border">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {item.product_name}
                {item.is_gift ? (
                  <Badge tone="success" size="sm">
                    <Gift />
                    {d.gift}
                  </Badge>
                ) : null}
                {item.is_upsell ? (
                  <Badge tone="info" size="sm">
                    {d.upsell}
                  </Badge>
                ) : null}
              </p>
              {item.options.length ? <p className="text-xs text-ink-3">{item.options.map((o) => `${o.option}: ${o.value}`).join(" · ")}</p> : null}
              {item.offer_name ? <p className="text-xs text-success">{d.offer(item.offer_name)}</p> : null}
            </div>
            <div className="shrink-0 text-end text-sm tabular">
              <p className="font-semibold">{formatMoney(item.line_total)}</p>
              <p className="text-xs text-ink-3">
                {item.quantity} × {formatMoney(item.unit_price)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1.5 border-t border-border px-5 py-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className={`tabular ${r.tone ?? ""}`}>{r.value}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2 text-base font-bold">
          <dt>{d.total}</dt>
          <dd className="tabular">{formatMoney(order.total)}</dd>
        </div>
        <p className="text-xs text-ink-3">{d.cod}</p>
      </dl>
    </Panel>
  );
}

function CustomerCard({ order, onEdit }: { order: OrderDetail; onEdit: () => void }) {
  const h = order.customer_history;
  return (
    <Panel>
      <PanelHeader
        title={d.customer}
        actions={
          order.can_edit_customer ? (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil />
              {d.editCustomer}
            </Button>
          ) : null
        }
      />
      <PanelBody className="flex flex-col gap-4">
        <DescriptionList
          columns={1}
          items={[
            { label: d.name, value: order.customer_name },
            {
              label: d.phone,
              value: (
                <a href={`tel:${order.customer_phone}`} dir="ltr" className="font-medium text-brand-strong hover:underline">
                  {formatPhone(order.customer_phone)}
                </a>
              ),
            },
            ...(order.customer_phone2
              ? [
                  {
                    label: d.phone2,
                    value: <span dir="ltr">{formatPhone(order.customer_phone2)}</span>,
                  },
                ]
              : []),
            ...(order.customer_email
              ? [
                  {
                    label: d.email,
                    value: (
                      <a href={`mailto:${order.customer_email}`} dir="ltr" className="text-brand-strong hover:underline">
                        {order.customer_email}
                      </a>
                    ),
                  },
                ]
              : []),
            {
              label: d.governorate,
              value: [order.governorate, order.city].filter(Boolean).join(" · "),
            },
            { label: d.address, value: order.address },
            ...(order.notes ? [{ label: d.notes, value: order.notes }] : []),
          ]}
        />
        <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <p>{d.history(h.total)}</p>
          {h.bad_ratio > 0 ? <p className="text-danger">{d.risk(h.bad_ratio)}</p> : null}
          {h.phone_blocked ? (
            <p className="flex items-center gap-1 text-danger">
              <Ban className="size-3" />
              {d.blocked}
            </p>
          ) : null}
        </div>
        {order.customer_id ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/customers/${order.customer_id}`}>
              <User />
              {d.customerPage}
            </Link>
          </Button>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function ShippingCard({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
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
    <Panel>
      <PanelHeader title={d.shipping_} />
      <PanelBody className="flex flex-col gap-3">
        {order.shipping.company ? (
          <p className="flex items-center gap-2 text-sm">
            <Truck className="size-4 text-ink-3" />
            {order.shipping.company.name}
          </p>
        ) : null}
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
      </PanelBody>
    </Panel>
  );
}

function InternalNote({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const [note, setNote] = React.useState(order.internal_note ?? "");
  const [busy, setBusy] = React.useState(false);
  const dirty = note.trim() !== (order.internal_note ?? "");

  async function save() {
    setBusy(true);
    try {
      await updateOrder(order.id, { internal_note: note.trim() || null });
      toast.success(d.noteSaved);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title={d.internalNote} description={d.internalNoteHint} />
      <PanelBody className="flex flex-col gap-2">
        <Textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} aria-label={d.internalNote} />
        {dirty ? (
          <Button size="sm" className="self-start" loading={busy} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

/** New orders: log each call attempt (no answer, call back later, WhatsApp sent). */
function Contact({ order, onSaved }: { order: OrderDetail; onSaved: () => Promise<unknown> }) {
  const c = d.contact;
  const [postponing, setPostponing] = React.useState(false);
  const [followUp, setFollowUp] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function send(result: "no_answer" | "postponed" | "whatsapp") {
    setBusy(result);
    try {
      await recordContact(order.id, {
        result,
        follow_up_at: result === "postponed" ? followUp : undefined,
      });
      toast.success(c.saved);
      setPostponing(false);
      setFollowUp("");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <PanelHeader title={c.title} description={c.attempts(order.contact_attempts)} />
      <PanelBody className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={busy === "no_answer"} onClick={() => void send("no_answer")}>
            <PhoneOff />
            {c.noAnswer}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPostponing((v) => !v)}>
            <Phone />
            {c.postponed}
          </Button>
          <Button size="sm" variant="secondary" loading={busy === "whatsapp"} onClick={() => void send("whatsapp")}>
            <MessageCircle />
            {c.whatsapp}
          </Button>
        </div>
        {postponing ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={c.followUp} htmlFor="follow-up">
              <DatePicker id="follow-up" withTime value={followUp} onChange={setFollowUp} />
            </Field>
            <Button size="sm" disabled={!followUp} loading={busy === "postponed"} onClick={() => void send("postponed")}>
              {ar.common.save}
            </Button>
          </div>
        ) : null}
        {order.follow_up_at ? <p className="text-xs text-ink-3">{`${c.followUp}: ${formatDateTime(order.follow_up_at)}`}</p> : null}
      </PanelBody>
    </Panel>
  );
}

const customerSchema = z.object({
  customer_name: zRequiredString(80, 2),
  customer_phone: zPhone,
  customer_phone2: z.string().trim(),
  governorate: z.string(),
  city: z.string().trim().max(100, ar.validation.max(100)),
  address: z.string().trim().max(300, ar.validation.max(300)),
  notes: z.string().trim().max(500, ar.validation.max(500)),
});
type CustomerValues = z.infer<typeof customerSchema>;

function CustomerDialog({ order, open, onOpenChange, onSaved }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <CustomerForm order={order} onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function CustomerForm({ order, onOpenChange, onSaved }: { order: OrderDetail; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  const shipping = useShipping();
  const [formError, setFormError] = React.useState<string | null>(null);
  const defaults: CustomerValues = {
    customer_name: order.customer_name,
    customer_phone: formatPhone(order.customer_phone),
    customer_phone2: order.customer_phone2 ? formatPhone(order.customer_phone2) : "",
    governorate: order.governorate ?? "",
    city: order.city ?? "",
    address: order.address ?? "",
    notes: order.notes ?? "",
  };
  const form = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CustomerValues) {
    setFormError(null);
    try {
      await updateOrder(order.id, {
        ...values,
        customer_phone2: values.customer_phone2 || null,
        governorate: values.governorate || null,
        city: values.city || null,
        address: values.address || null,
        notes: values.notes || null,
      });
      toast.success(d.customerSaved);
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, Object.keys(defaults));
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <DialogContent size="md">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <DialogHeader title={d.editCustomer} />
        <DialogBody className="flex flex-col gap-3">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Field label={d.name} htmlFor="cust-name" error={errors.customer_name?.message} required>
            <Input id="cust-name" aria-invalid={!!errors.customer_name} {...form.register("customer_name")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={d.phone} htmlFor="cust-phone" error={errors.customer_phone?.message} required>
              <Controller
                control={form.control}
                name="customer_phone"
                render={({ field }) => <PhoneInput id="cust-phone" value={field.value} onChange={field.onChange} aria-invalid={!!errors.customer_phone} />}
              />
            </Field>
            <Field label={d.phone2} htmlFor="cust-phone2" error={errors.customer_phone2?.message} optional>
              <Controller control={form.control} name="customer_phone2" render={({ field }) => <PhoneInput id="cust-phone2" value={field.value} onChange={field.onChange} />} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={d.governorate} htmlFor="cust-gov" error={errors.governorate?.message}>
              <Controller
                control={form.control}
                name="governorate"
                render={({ field }) => (
                  <Select
                    id="cust-gov"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={(shipping.data?.governorates ?? []).map((g) => ({
                      value: g,
                      label: g,
                    }))}
                    placeholder={d.governorate}
                  />
                )}
              />
            </Field>
            <Field label={d.city} htmlFor="cust-city" error={errors.city?.message}>
              <Input id="cust-city" {...form.register("city")} />
            </Field>
          </div>
          <Field label={d.address} htmlFor="cust-address" error={errors.address?.message}>
            <Textarea id="cust-address" rows={2} {...form.register("address")} />
          </Field>
          <Field label={d.notes} htmlFor="cust-notes" error={errors.notes?.message}>
            <Textarea id="cust-notes" rows={2} {...form.register("notes")} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Status changes and contact attempts, newest first. */
function timeline(order: OrderDetail): TimelineEvent[] {
  const tones: Partial<Record<string, TimelineEvent["tone"]>> = {
    delivered: "success",
    shipped: "brand",
    confirmed: "brand",
    cancelled: "neutral",
    fake: "danger",
    returned: "danger",
    damaged: "danger",
    new: "attention",
  };
  type Sorted = TimelineEvent & { sort: string };
  const statuses: Sorted[] = order.logs.map((log) => ({
    id: `s${log.id}`,
    title: log.from_status === null ? d.created : log.to_label,
    by: log.user ? d.by(log.user.name) : undefined,
    at: formatDateTime(log.created_at),
    body: log.note ?? undefined,
    tone: tones[log.to_status] ?? "neutral",
    sort: log.created_at,
  }));
  const events: Sorted[] = order.events.map((e) => ({
    id: `e${e.id}`,
    title: e.label,
    by: e.user ? d.by(e.user.name) : undefined,
    at: formatDateTime(e.created_at),
    body: [e.note, e.follow_up_at ? `${d.contact.followUp}: ${formatDateTime(e.follow_up_at)}` : null].filter(Boolean).join(" · ") || undefined,
    tone: "neutral",
    sort: e.created_at,
  }));
  return [...statuses, ...events]
    .sort((a, b) => (a.sort < b.sort ? 1 : -1))
    .map(({ id, title, by, at, body, tone }) => ({
      id,
      title,
      by,
      at,
      body,
      tone,
    }));
}
