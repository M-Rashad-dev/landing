"use client";

import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { BarChart3, Bell, Bot, CalendarClock, CheckCheck, Globe, Headset, MailWarning, PackageMinus, ReceiptText, ShoppingBag, Store, TableProperties, Truck, Undo2, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton, toast } from "@/components/ui/feedback";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { bellKey, markAllRead, markRead, useBell, useBellLive, type BellArea, type BellItem, type BellPage } from "./api";
import { OPEN_SUPPORT_EVENT } from "./events";

const t = ar.notifications.bell;

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  new_order: { icon: ShoppingBag, tone: "bg-brand-soft text-brand-strong" },
  low_stock: { icon: PackageMinus, tone: "bg-warning-soft text-warning" },
  plan_expiring: { icon: CalendarClock, tone: "bg-accent-soft text-accent-ink" },
  plan_expired: { icon: CalendarClock, tone: "bg-danger-soft text-danger" },
  receipt_approved: { icon: ReceiptText, tone: "bg-success-soft text-success" },
  receipt_rejected: { icon: ReceiptText, tone: "bg-danger-soft text-danger" },
  support_reply: { icon: Headset, tone: "bg-info-soft text-info" },
  domain_ready: { icon: Globe, tone: "bg-success-soft text-success" },
  import_done: { icon: TableProperties, tone: "bg-brand-soft text-brand-strong" },
  shipment_problem: { icon: Truck, tone: "bg-warning-soft text-warning" },
  mailbox_failed: { icon: MailWarning, tone: "bg-danger-soft text-danger" },
  receipt_submitted: { icon: ReceiptText, tone: "bg-accent-soft text-accent-ink" },
  refund_requested: { icon: Undo2, tone: "bg-danger-soft text-danger" },
  store_registered: { icon: Store, tone: "bg-brand-soft text-brand-strong" },
  support_ticket: { icon: Headset, tone: "bg-info-soft text-info" },
  daily_summary: { icon: BarChart3, tone: "bg-surface-2 text-ink-2" },
  ai_paused: { icon: Bot, tone: "bg-warning-soft text-warning" },
  ai_low_balance: { icon: Wallet, tone: "bg-warning-soft text-warning" },
};

/**
 * The bell in the top bar: the user's notifications (live through Reverb, with a toast), unread
 * count, mark read on open / all at once. `extra` (the admin's "what waits") shows above the list.
 */
export function NotificationBell({ area, userId, extra, extraCount = 0 }: { area: BellArea; userId: number; extra?: React.ReactNode; extraCount?: number }) {
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const bell = useBell(area);
  const unread = bell.data?.pages[0]?.unread ?? 0;

  useBellLive(area, userId, (item) => toast(item.title, { description: item.body }));

  const update = (fn: (page: BellPage, index: number) => BellPage) =>
    client.setQueryData<InfiniteData<BellPage, number | null>>(bellKey(area), (old) => (old ? { ...old, pages: old.pages.map(fn) } : old));

  function openItem(item: BellItem) {
    if (!item.read) {
      update((page, index) => ({ ...page, unread: index === 0 ? Math.max(0, page.unread - 1) : page.unread, items: page.items.map((n) => (n.id === item.id ? { ...n, read: true } : n)) }));
      void markRead(area, item.id).catch(() => undefined);
    }
    setOpen(false);
    const support = item.event === "support_reply" ? Number(new URL(item.link ?? "/", "http://x").searchParams.get("support")) : 0;
    if (support > 0) {
      window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_EVENT, { detail: support }));
      return;
    }
    if (item.link) router.push(item.link);
  }

  function readAll() {
    update((page, index) => ({ ...page, unread: index === 0 ? 0 : page.unread, items: page.items.map((n) => ({ ...n, read: true })) }));
    void markAllRead(area).catch(() => void client.invalidateQueries({ queryKey: bellKey(area) }));
  }

  const items = bell.data?.pages.flatMap((p) => p.items) ?? [];
  const count = unread + extraCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread > 0 ? `${t.open} (${unread})` : t.open} className="relative">
          <Bell />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white tabular ring-2 ring-bg">
              {t.unread(unread)}
            </span>
          ) : count > 0 ? (
            <span className="absolute end-2 top-2 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{t.title}</p>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={readAll}>
              <CheckCheck />
              {t.markAll}
            </Button>
          ) : null}
        </div>
        {extra ? <div className="border-b border-border px-4 py-3">{extra}</div> : null}
        <div className="max-h-[min(28rem,70dvh)] overflow-y-auto [scrollbar-width:thin]">
          {bell.isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : bell.isError ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <p className="text-[13px] text-ink-3">{t.error}</p>
              <Button variant="outline" size="sm" onClick={() => void bell.refetch()}>
                {t.retry}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                <Bell className="size-5" />
              </span>
              <p className="text-sm font-semibold">{t.empty}</p>
              <p className="text-[13px] text-ink-3">{t.emptyText}</p>
            </div>
          ) : (
            <ul className="flex flex-col py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <BellRow item={item} onOpen={() => openItem(item)} />
                </li>
              ))}
            </ul>
          )}
          {bell.hasNextPage ? (
            <div className="border-t border-border p-2">
              <Button variant="ghost" size="sm" className="w-full" loading={bell.isFetchingNextPage} onClick={() => void bell.fetchNextPage()}>
                {t.more}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BellRow({ item, onOpen }: { item: BellItem; onOpen: () => void }) {
  const { icon: Icon, tone } = ICONS[item.event] ?? { icon: Bell, tone: "bg-surface-2 text-ink-2" };
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-start transition-colors hover:bg-surface-2", !item.read && "bg-brand-soft/30")}>
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[13px] leading-snug", item.read ? "text-ink-2" : "font-semibold text-ink")}>{item.title}</span>
        <span className="line-clamp-2 text-xs leading-relaxed text-ink-3">{item.body}</span>
        <span className="tabular text-[11px] text-ink-3">{formatDateTime(item.created_at)}</span>
      </span>
      {!item.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-danger" aria-hidden /> : null}
    </button>
  );
}
