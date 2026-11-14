"use client";

import { ArrowLeftRight, ExternalLink, MessageCircle, Phone } from "lucide-react";
import * as React from "react";
import { DescriptionList, EntityCell } from "@/components/data/details";
import { OrderSourceTag, OrderStatusBadge } from "@/components/domain/order-status";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { useSession } from "@/lib/auth/session-context";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useOrder, useRefreshOrders, whatsappLink, type OrderDetail, type OrderRow } from "./api";
import { StatusDialog } from "./status-dialog";

const t = ar.orders;

/** The WhatsApp text asking the customer to confirm. */
export function confirmMessage(order: Pick<OrderDetail, "customer_name" | "order_number" | "items" | "total">, store: string): string {
  const items = order.items
    .filter((i) => !i.is_gift)
    .map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.product_name}` : i.product_name))
    .join("، ");
  return t.whatsappConfirm(order.customer_name.split(" ")[0] ?? order.customer_name, store, order.order_number, items, order.total);
}

/** Opened from the list: the order at a glance and the main actions, without leaving the table. */
export function OrderQuickView({ row, onClose, onOpen }: { row: OrderRow | null; onClose: () => void; onOpen: (id: number) => void }) {
  return (
    <Drawer
      open={row !== null}
      onOpenChange={(o) => !o && onClose()}
      title={row ? t.detail.title(row.order_number) : ""}
      description={
        row ? (
          <span className="flex flex-wrap items-center gap-2">
            {formatDateTime(row.created_at)}
            <OrderSourceTag source={row.source} page={row.page} />
          </span>
        ) : undefined
      }
    >
      {row ? <QuickBody key={row.id} id={row.id} onOpen={() => onOpen(row.id)} /> : null}
    </Drawer>
  );
}

function QuickBody({ id, onOpen }: { id: number; onOpen: () => void }) {
  const session = useSession();
  const query = useOrder(id);
  const refresh = useRefreshOrders();
  const [changing, setChanging] = React.useState(false);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-12" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const order = query.data;
  const store = session.store_name ?? session.tenant?.name ?? "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <OrderStatusBadge status={order.status} />
        <span className="text-lg font-bold tabular">{formatMoney(order.total)}</span>
      </div>

      <EntityCell avatar={order.customer_name} title={order.customer_name} subtitle={<span dir="ltr">{formatPhone(order.customer_phone)}</span>} />

      <ul className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3">
            <span>
              <span className="font-medium">{item.product_name}</span>
              {item.options.length ? <span className="block text-xs text-ink-3">{item.options.map((o) => `${o.option}: ${o.value}`).join(" · ")}</span> : null}
              {item.is_gift ? <span className="block text-xs text-success">{t.detail.gift}</span> : null}
            </span>
            <span className="shrink-0 tabular text-ink-2">× {item.quantity}</span>
          </li>
        ))}
      </ul>

      <DescriptionList
        columns={1}
        items={[
          {
            label: t.detail.governorate,
            value: [order.governorate, order.city].filter(Boolean).join(" · "),
          },
          { label: t.detail.address, value: order.address },
          {
            label: t.detail.shipping_,
            value: order.shipping.company ? `${order.shipping.company.name}${order.shipping.tracking_number ? ` · ${order.shipping.tracking_number}` : ""}` : null,
          },
          { label: t.detail.notes, value: order.notes },
        ]}
      />

      <div className="flex flex-col gap-2">
        <Button onClick={() => setChanging(true)} disabled={order.allowed_transitions.length === 0}>
          <ArrowLeftRight />
          {t.status.change}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <a href={whatsappLink(order.customer_phone, confirmMessage(order, store))} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              {t.whatsapp}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`tel:${order.customer_phone}`}>
              <Phone />
              {t.call}
            </a>
          </Button>
        </div>
        <Button variant="ghost" onClick={onOpen}>
          <ExternalLink />
          {t.open}
        </Button>
      </div>

      <StatusDialog open={changing} onOpenChange={setChanging} targets={order.allowed_transitions.map((x) => x.status)} ids={[order.id]} onDone={() => refresh()} />
    </div>
  );
}
