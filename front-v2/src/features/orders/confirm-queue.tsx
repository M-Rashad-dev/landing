"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, MessageCircle, PartyPopper, PhoneOff, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { OrderStatusBadge } from "@/components/domain/order-status";
import { DatePicker } from "@/components/forms/date-pickers";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { apiPage } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { ar } from "@/messages/ar";
import { changeStatus, recordContact, useOrder, useRefreshOrders, whatsappLink, type OrderRow, type OrderStatus } from "./api";
import { confirmMessage } from "./order-quick-view";
import { StatusDialog } from "./status-dialog";

const t = ar.orders.queue;
const d = ar.orders.detail;

export function useConfirmQueue() {
  return useQuery({
    queryKey: ["orders", "queue"],
    queryFn: async () => {
      const page = await apiPage<OrderRow>("/dashboard/orders/confirmation-queue");
      return { data: page.data, meta: { due: Number(page.meta.due ?? 0), later: Number(page.meta.later ?? 0) } };
    },
  });
}

/** New orders one by one, in calling order (due callbacks and never-called first). */
export function ConfirmQueue() {
  const queue = useConfirmQueue();
  const [index, setIndex] = React.useState(0);
  const list = queue.data?.data ?? [];
  const current = list[Math.min(index, Math.max(0, list.length - 1))];

  return (
    <>
      <PageHeader
        crumbs={[{ label: d.back, href: "/dashboard/orders" }, { label: t.title }]}
        title={t.title}
        description={t.description}
        actions={
          list.length > 1 ? (
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" aria-label={t.previous} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <ChevronRight />
              </Button>
              <span className="text-sm tabular text-ink-2">{t.position(Math.min(index, list.length - 1) + 1, list.length)}</span>
              <Button size="icon" variant="outline" aria-label={t.next} disabled={index >= list.length - 1} onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}>
                <ChevronLeft />
              </Button>
            </div>
          ) : null
        }
      />

      {queue.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : queue.isError ? (
        <ErrorState onRetry={() => void queue.refetch()} message={errorMessage(queue.error)} />
      ) : !current ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={PartyPopper}
            title={t.doneTitle}
            description={t.doneText}
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/orders">{t.backToOrders}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-2">
              {t.due(queue.data.meta.due)} {t.later(queue.data.meta.later)}
            </p>
            <QueueCard key={current.id} id={current.id} onNext={() => setIndex((i) => Math.min(i + 1, list.length - 1))} onDone={() => void queue.refetch()} />
            <p className="hidden text-xs text-ink-3 lg:block">{t.keys}</p>
          </div>
          <Panel>
            <PanelHeader title={t.upcoming} />
            <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
              {list.map((o, i) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2 ${o.id === current.id ? "bg-brand-soft/60" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.customer_name}</span>
                      <span className="block text-xs text-ink-3 tabular">
                        #{o.order_number} · {formatMoney(o.total)}
                      </span>
                    </span>
                    {o.follow_up_at && new Date(o.follow_up_at) > new Date() ? (
                      <Badge size="sm" tone="info">
                        <Clock />
                        {t.scheduled}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}

function QueueCard({ id, onNext, onDone }: { id: number; onNext: () => void; onDone: () => void }) {
  const session = useSession();
  const query = useOrder(id);
  const refresh = useRefreshOrders();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [postponing, setPostponing] = React.useState(false);
  const [followUp, setFollowUp] = React.useState("");
  const [closing, setClosing] = React.useState<OrderStatus | null>(null);
  const order = query.data;
  const store = session.store_name ?? session.tenant?.name ?? "";

  const run = React.useCallback(
    async (key: string, action: () => Promise<unknown>, message: string) => {
      setBusy(key);
      try {
        await action();
        toast.success(message);
        await refresh();
        onDone();
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [refresh, onDone],
  );

  const confirm = React.useCallback(() => order && void run("confirm", () => changeStatus(order.id, { status: "confirmed" }), t.confirmed(order.order_number)), [order, run]);
  const noAnswer = React.useCallback(() => order && void run("no_answer", () => recordContact(order.id, { result: "no_answer" }), t.recorded), [order, run]);
  const whatsapp = React.useCallback(() => {
    if (!order) return;
    window.open(whatsappLink(order.customer_phone, confirmMessage(order, store)), "_blank", "noopener,noreferrer");
    void run("whatsapp", () => recordContact(order.id, { result: "whatsapp" }), t.recorded);
  }, [order, run, store]);

  // Keyboard: C confirm, N no answer, W WhatsApp, ← next (RTL: left = forward).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, [role=dialog]") !== null;
      if (busy || e.ctrlKey || e.metaKey || e.altKey || typing) return;
      const key = e.key.toLowerCase();
      if (key === "c") confirm();
      else if (key === "n") noAnswer();
      else if (key === "w") whatsapp();
      else if (e.key === "ArrowLeft") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, confirm, noAnswer, whatsapp, onNext]);

  if (query.isPending) return <Skeleton className="h-96 rounded-xl" />;
  if (query.isError || !order) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const h = order.customer_history;

  return (
    <Panel>
      <PanelBody className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-3 tabular">
              <Link href={`/dashboard/orders/${order.id}`} className="font-semibold text-brand-strong hover:underline">
                #{order.order_number}
              </Link>{" "}
              · {formatDateTime(order.created_at)} · {order.source === "store" ? ar.domain.source.store : (order.page?.title ?? ar.domain.source.landing)}
            </p>
            <p className="mt-1 text-2xl font-bold">{order.customer_name}</p>
            <a href={`tel:${order.customer_phone}`} dir="ltr" className="text-xl font-semibold tabular text-brand-strong hover:underline">
              {formatPhone(order.customer_phone)}
            </a>
            {order.customer_phone2 ? (
              <p dir="ltr" className="text-sm tabular text-ink-2">
                {formatPhone(order.customer_phone2)}
              </p>
            ) : null}
          </div>
          <div className="text-end">
            <OrderStatusBadge status={order.status} />
            <p className="mt-2 text-2xl font-bold tabular">{formatMoney(order.total)}</p>
            <p className="text-xs text-ink-3">{d.contact.attempts(order.contact_attempts)}</p>
          </div>
        </div>

        <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <p>{[order.governorate, order.city, order.address].filter(Boolean).join("، ")}</p>
          {order.notes ? <p className="mt-1 text-ink-2">{order.notes}</p> : null}
        </div>

        <ul className="flex flex-col gap-1.5 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.product_name}
                {item.options.length ? <span className="text-ink-3"> · {item.options.map((o) => o.value).join(" / ")}</span> : null}
                {item.is_gift ? <span className="text-success"> · {d.gift}</span> : null}
              </span>
              <span className="tabular text-ink-2">× {item.quantity}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge>{d.history(h.total)}</Badge>
          {h.bad_ratio > 0 ? (
            <Badge tone="danger">
              <ShieldAlert />
              {d.risk(h.bad_ratio)}
            </Badge>
          ) : null}
          {order.is_duplicate_suspect ? <Badge tone="warning">{ar.orders.duplicateHint}</Badge> : null}
          {order.follow_up_at ? <Badge tone="info">{t.followUpAt(formatDateTime(order.follow_up_at))}</Badge> : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" loading={busy === "confirm"} onClick={confirm}>
            <CheckCircle2 />
            {t.confirm}
          </Button>
          <Button size="lg" variant="outline" loading={busy === "whatsapp"} onClick={whatsapp}>
            <MessageCircle />
            {t.whatsapp}
          </Button>
          <Button variant="secondary" loading={busy === "no_answer"} onClick={noAnswer}>
            <PhoneOff />
            {t.noAnswer}
          </Button>
          <Button variant="secondary" onClick={() => setPostponing(true)}>
            <Clock />
            {t.postpone}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button size="sm" variant="ghost" onClick={() => setClosing("cancelled")}>
            <XCircle />
            {t.cancel}
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={() => setClosing("fake")}>
            <ShieldAlert />
            {t.fake}
          </Button>
          <Button size="sm" variant="ghost" className="ms-auto" onClick={onNext}>
            {t.next}
            <ChevronLeft />
          </Button>
        </div>
      </PanelBody>

      <Dialog open={postponing} onOpenChange={setPostponing}>
        <DialogContent size="sm">
          <DialogHeader title={t.postponeTitle} />
          <DialogBody>
            <DatePicker withTime value={followUp} onChange={setFollowUp} className="sm:w-full" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostponing(false)}>
              {ar.common.cancel}
            </Button>
            <Button
              disabled={!followUp}
              loading={busy === "postponed"}
              onClick={() =>
                void run("postponed", () => recordContact(order.id, { result: "postponed", follow_up_at: followUp }), t.recorded).then(() => {
                  setPostponing(false);
                  setFollowUp("");
                })
              }
            >
              {ar.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StatusDialog
        open={closing !== null}
        onOpenChange={(o) => !o && setClosing(null)}
        targets={closing ? [closing] : []}
        initial={closing ?? undefined}
        ids={[order.id]}
        onDone={async () => {
          await refresh();
          onDone();
        }}
      />
    </Panel>
  );
}
