"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, ExternalLink, PartyPopper, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { ContactActions } from "@/components/orders/contact-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPhoneLocal } from "@/lib/format/phone";
import { changeOrderStatus, orderKeys, useConfirmationQueue, useOrder, type OrderDetail, type OrderRow } from "@/lib/orders/api";
import { telLink } from "@/lib/orders/whatsapp";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.orders.queue;
const c = ar.orders.contact;

/** Call-center mode: one order at a time, due ones first, big actions, keyboard shortcuts. */
export function ConfirmationQueue() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useConfirmationQueue();
  const [pickedId, setPickedId] = useState<number | null>(null);
  const orders = data?.orders ?? [];
  const currentId = orders.some((o) => o.id === pickedId) ? pickedId : (orders[0]?.id ?? null);

  // After an action the order leaves the queue or moves down: refresh and go to the next one.
  const advance = (updated: OrderDetail) => {
    queryClient.setQueryData(orderKeys.detail(updated.id), updated);
    const index = orders.findIndex((o) => o.id === updated.id);
    setPickedId(orders[index + 1]?.id ?? orders[0]?.id ?? null);
    void queryClient.invalidateQueries({ queryKey: orderKeys.queue });
    void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["orders", "notifications"] });
  };

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (orders.length === 0) return <EmptyState icon={PartyPopper} title={t.emptyTitle} description={t.emptyText} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="gold">{t.due(data.due)}</Badge>
        {data.later > 0 ? <Badge variant="secondary">{t.later(data.later)}</Badge> : null}
        <span className="ms-auto hidden text-xs text-muted-foreground lg:inline">{t.shortcuts}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {currentId ? <Current key={currentId} id={currentId} onDone={advance} onUpdate={(updated) => queryClient.setQueryData(orderKeys.detail(updated.id), updated)} /> : null}
        <Card className="h-fit max-h-[75vh] overflow-hidden p-0">
          <p className="border-b px-4 py-3 text-sm font-semibold">{t.upNext}</p>
          <ol className="max-h-[calc(75vh-3rem)] overflow-y-auto">
            {orders.map((order) => (
              <QueueItem key={order.id} order={order} active={order.id === currentId} onClick={() => setPickedId(order.id)} />
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function QueueItem({ order, active, onClick }: { order: OrderRow; active: boolean; onClick: () => void }) {
  const scheduled = order.follow_up_at !== null && new Date(order.follow_up_at) > new Date();
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active || undefined}
        className={cn("flex w-full items-center gap-3 border-b px-4 py-3 text-start transition-colors last:border-0", active ? "bg-secondary" : "hover:bg-accent", scheduled && !active && "opacity-60")}
      >
        <span className="w-12 shrink-0 font-display text-sm font-semibold tabular-nums">#{order.order_number}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{order.customer_name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {scheduled ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" aria-hidden />
                {formatCairo(order.follow_up_at)}
              </span>
            ) : (
              c.attempts(order.contact_attempts)
            )}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums">{formatPrice(order.total)}</span>
      </button>
    </li>
  );
}

function Current({ id, onDone, onUpdate }: { id: number; onDone: (order: OrderDetail) => void; onUpdate: (order: OrderDetail) => void }) {
  const { data: order, isPending, isError, error, refetch } = useOrder(id);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function setStatus(status: "confirmed" | "cancelled") {
    if (!order) return;
    setBusy(true);
    try {
      const updated = await changeOrderStatus(order.id, { status });
      toast.success(ar.orders.changed);
      setCancelling(false);
      onDone(updated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // C: call · W: WhatsApp · Enter: confirm · N: no answer (not while typing).
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (!order || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || document.querySelector("[role=dialog]")) return;
    const key = event.key.toLowerCase();
    if (key === "enter" && !busy) void setStatus("confirmed");
    else if (key === "c") window.location.href = telLink(order.customer_phone);
    else if (key === "w") document.querySelector<HTMLAnchorElement>("[data-queue-current] a[href^='https://wa.me']")?.click();
    else if (key === "n") document.querySelector<HTMLButtonElement>("[data-queue-current] [data-action=no-answer]")?.click();
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !order) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <Card data-queue-current className="flex flex-col gap-5 p-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t.current}</p>
          <h2 className="font-display text-2xl font-semibold">
            #{order.order_number} · {order.customer_name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatCairo(order.created_at)}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/orders/${order.id}`}>
            <ExternalLink />
            {t.openOrder}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-display text-lg font-semibold tabular-nums" dir="ltr">
            {formatPhoneLocal(order.customer_phone)}
          </p>
          <p className="text-muted-foreground">{[order.governorate, order.city].filter(Boolean).join(" — ")}</p>
          {order.address ? <p>{order.address}</p> : null}
          {order.notes ? <p className="mt-2 rounded-lg bg-gold-soft px-3 py-2 text-gold-foreground">{order.notes}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          {order.items.map((item) => (
            <p key={item.id}>
              <span className="font-semibold">
                {item.quantity} × {item.product_name}
              </span>
              {item.options.length ? <span className="text-muted-foreground"> ({item.options.map((o) => o.value).join("، ")})</span> : null}
            </p>
          ))}
          <p className="mt-auto font-display text-xl font-semibold">{formatPrice(order.total)}</p>
        </div>
      </div>

      <ContactActions
        order={order}
        size="lg"
        // After WhatsApp the seller usually waits for the reply; other results move to the next order.
        onChange={(updated, result) => (result === "whatsapp" ? onUpdate(updated) : onDone(updated))}
      />

      <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row">
        <Button size="lg" className="flex-1" loading={busy} onClick={() => void setStatus("confirmed")}>
          <Check />
          {c.confirm}
        </Button>
        <Button size="lg" variant="outline" className="text-destructive" onClick={() => setCancelling(true)}>
          <X />
          {c.cancel}
        </Button>
      </div>

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={c.cancel}
        description={`#${order.order_number} · ${order.customer_name}`}
        confirmLabel={c.cancel}
        destructive
        loading={busy}
        onConfirm={() => void setStatus("cancelled")}
      />
    </Card>
  );
}
