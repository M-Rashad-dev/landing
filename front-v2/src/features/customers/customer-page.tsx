"use client";

import { Ban, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DescriptionList } from "@/components/data/details";
import { StatCard } from "@/components/data/stat-card";
import { OrderStatusBadge } from "@/components/domain/order-status";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { whatsappLink } from "@/features/orders/api";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { ar } from "@/messages/ar";
import { blockCustomer, saveCustomerNote, useCustomer, useRefreshCustomers, type CustomerDetail } from "./api";

const t = ar.orders.customers;
const d = t.detail;

export function CustomerPage({ id }: { id: number }) {
  const query = useCustomer(id);
  const refresh = useRefreshCustomers();
  const [blocking, setBlocking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const c = query.data;

  async function toggleBlock() {
    setBusy(true);
    try {
      await blockCustomer(c.id, !c.blocked);
      toast.success(c.blocked ? d.unblocked : d.blocked);
      setBlocking(false);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: d.back, href: "/dashboard/customers" }, { label: c.name ?? formatPhone(c.phone) }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name ?? formatPhone(c.phone)}
            {c.blocked ? (
              <Badge tone="danger">
                <Ban />
                {t.blocked}
              </Badge>
            ) : null}
          </span>
        }
        description={c.first_order_at ? d.since(formatDateTime(c.first_order_at).slice(0, 10)) : undefined}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`tel:${c.phone}`}>
                <Phone />
                {ar.orders.call}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={whatsappLink(c.phone, "")} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                {ar.orders.whatsapp}
              </a>
            </Button>
            <Button variant={c.blocked ? "secondary" : "danger-ghost"} onClick={() => (c.blocked ? void toggleBlock() : setBlocking(true))} loading={busy && c.blocked}>
              {c.blocked ? <ShieldCheck /> : <Ban />}
              {c.blocked ? d.unblock : d.block}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={d.spent} value={formatMoney(c.spent)} hint={d.spentHint} />
        <StatCard label={d.orders} value={String(c.orders_count)} />
        <StatCard label={d.average} value={formatMoney(c.average_order)} />
        <StatCard label={d.returns} value={String(c.bad_count)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel>
          <PanelHeader title={d.ordersTitle} />
          {c.orders.length === 0 ? (
            <EmptyState compact title={d.noOrders} />
          ) : (
            <ul className="divide-y divide-border">
              {c.orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tabular">#{o.order_number}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {ar.orders.itemsSummary(o.items_summary?.first ?? null, o.items_summary?.count ?? 0)} · {formatDateTime(o.created_at)}
                      </span>
                    </span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-24 text-end font-semibold tabular">{formatMoney(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelBody>
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: ar.orders.detail.phone,
                    value: <span dir="ltr">{formatPhone(c.phone)}</span>,
                  },
                  {
                    label: d.address,
                    value: [c.governorate, c.city, c.address].filter(Boolean).join("، "),
                  },
                  {
                    label: d.lastOrder,
                    value: formatDateTime(c.last_order_at),
                  },
                ]}
              />
            </PanelBody>
          </Panel>
          <Note customer={c} onSaved={refresh} />
          {c.open_leads.length > 0 ? (
            <Panel>
              <PanelHeader title={d.leadsTitle} />
              <ul className="divide-y divide-border text-sm">
                {c.open_leads.map((l) => (
                  <li key={l.id} className="px-5 py-2.5">
                    <span className="block font-medium">{ar.orders.abandoned.kinds[l.source]}</span>
                    <span className="text-xs text-ink-3">
                      {l.cart ? `${ar.orders.itemsSummary(l.cart.items[0]?.name ?? null, l.cart.items.length)} · ${formatMoney(l.cart.total)}` : ar.orders.abandoned.items(l.quantity)} ·{" "}
                      {formatDateTime(l.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>

      <ConfirmDialog open={blocking} onOpenChange={setBlocking} title={d.blockTitle} description={d.blockText} confirmLabel={d.block} destructive loading={busy} onConfirm={() => void toggleBlock()} />
    </>
  );
}

function Note({ customer, onSaved }: { customer: CustomerDetail; onSaved: () => Promise<unknown> }) {
  const [note, setNote] = React.useState(customer.note ?? "");
  const [busy, setBusy] = React.useState(false);
  const dirty = note.trim() !== (customer.note ?? "");

  async function save() {
    setBusy(true);
    try {
      await saveCustomerNote(customer.id, note.trim() || null);
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
      <PanelHeader title={d.note} />
      <PanelBody className="flex flex-col gap-2">
        <Textarea rows={3} maxLength={2000} placeholder={d.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} aria-label={d.note} />
        {dirty ? (
          <Button size="sm" className="self-start" loading={busy} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
