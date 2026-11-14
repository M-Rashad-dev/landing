"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Headset, Loader2, Lock, RotateCcw, Search, Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, apiPage, type Paginated } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { applyUpdate, closeTicket, markRead, reopenTicket, sendMessage, supportKey, useConversation, type Ticket } from "../support/api";
import { closesText, Composer, Thread } from "../support/chat";
import { SupportStats } from "./support-stats";

const t = ar.support;
const TABS = ["waiting_support", "waiting_merchant", "closed", "all"] as const;
type Tab = (typeof TABS)[number];
type ListPage = Paginated<Ticket> & { meta: Paginated<Ticket>["meta"] & { counts: Record<string, number> } };

/** «الدعم»: every store's conversation with support, and the performance numbers. */
export function SupportPage() {
  const [url, setUrl] = useUrlState(["view", "status", "q", "page", "ticket"] as const);
  const view = url.view === "stats" ? "stats" : "inbox";

  return (
    <>
      <PageHeader
        title={t.admin.title}
        description={t.admin.description}
        tabs={
          <Tabs value={view} onValueChange={(v) => setUrl({ view: v === "inbox" ? null : v })}>
            <TabsList>
              <TabsTrigger value="inbox">{t.admin.inbox}</TabsTrigger>
              <TabsTrigger value="stats">{t.admin.performance}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {view === "stats" ? <SupportStats /> : <Inbox url={url} setUrl={setUrl} />}
    </>
  );
}

function Inbox({ url, setUrl }: { url: Record<"status" | "q" | "page" | "ticket", string>; setUrl: (patch: Partial<Record<"view" | "status" | "q" | "page" | "ticket", string | null>>) => void }) {
  const tab: Tab = (TABS as readonly string[]).includes(url.status) ? (url.status as Tab) : "waiting_support";
  const page = Math.max(1, Number(url.page) || 1);
  const selected = /^\d+$/.test(url.ticket) ? Number(url.ticket) : null;
  const [search, setSearch] = React.useState(url.q);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const list = useQuery({
    queryKey: supportKey("support", "list", tab, url.q, page),
    queryFn: () => apiPage<Ticket>("/admin/support/tickets", { query: { status: tab, q: url.q, page } }) as Promise<ListPage>,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_280px]">
      <aside className={cn("flex min-h-0 flex-col border-border lg:border-e", selected !== null && "max-lg:hidden")}>
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <InputGroup start={<Search className="size-4" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.admin.search} aria-label={t.admin.search} />
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {TABS.map((k) => (
              <button key={k} type="button" onClick={() => setUrl({ status: k === "waiting_support" ? null : k, page: null })} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold", tab === k ? "bg-brand-soft text-brand-strong" : "text-ink-3 hover:bg-surface-2")}>
                {t.admin.tabs[k]}
                <span className="tabular rounded-full bg-surface-2 px-1.5 text-[10px] text-ink-2">{formatNumber(list.data?.meta.counts[k] ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto">
          {list.isPending ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState onRetry={() => void list.refetch()} message={errorMessage(list.error)} />
          ) : list.data.data.length === 0 ? (
            <EmptyState compact icon={Headset} title={t.admin.empty} />
          ) : (
            <ul className="divide-y divide-border">
              {list.data.data.map((ticket) => (
                <li key={ticket.number}>
                  <button type="button" onClick={() => setUrl({ ticket: String(ticket.number) })} className={cn("flex w-full items-start gap-2 px-3 py-3 text-start hover:bg-surface-2/60", selected === ticket.number && "bg-brand-soft/60")}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm">
                        <span className="font-bold tabular">{t.ticket(ticket.number)}</span>
                        <span className="truncate font-semibold">{ticket.store.name}</span>
                      </p>
                      <p className={cn("truncate text-xs", ticket.unread_support ? "font-semibold text-ink" : "text-ink-3")}>
                        {ticket.last_message ? `${ticket.last_message.sender === "support" ? `${t.chat.you}: ` : ""}${ticket.last_message.preview || t.list.files(ticket.last_message.files)}` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
                        <span>{t.topics[ticket.topic]}</span>·<span>{ticket.last_message_at ? formatDateTime(ticket.last_message_at) : ""}</span>
                      </p>
                    </div>
                    {ticket.unread_support ? <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-danger" aria-hidden /> : null}
                    {ticket.rating ? (
                      <span className="flex shrink-0 items-center gap-0.5 text-xs text-accent-ink">
                        <Star className="size-3 fill-current" aria-hidden />
                        {ticket.rating}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {list.data && list.data.meta.last_page > 1 ? (
          <div className="border-t border-border p-2">
            <Pagination page={page} lastPage={list.data.meta.last_page} onPageChange={(p) => setUrl({ page: String(p) })} />
          </div>
        ) : null}
      </aside>
      {selected === null ? (
        <div className="hidden items-center justify-center p-10 text-sm text-ink-3 lg:flex">{t.admin.pick}</div>
      ) : (
        <AdminChat key={selected} number={selected} onBack={() => setUrl({ ticket: null })} />
      )}
    </div>
  );
}

function AdminChat({ number, onBack }: { number: number; onBack: () => void }) {
  const client = useQueryClient();
  const query = useConversation("support", number);
  const [confirm, setConfirm] = React.useState<"close" | "reopen" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const unread = query.data?.ticket.unread_support ?? false;

  React.useEffect(() => {
    if (!unread) return;
    void markRead("support", number)
      .then((updated) => {
        applyUpdate(client, "support", updated, null);
        void client.invalidateQueries({ queryKey: ["support", "support"], predicate: (q) => q.queryKey[2] !== "ticket" });
      })
      .catch(() => undefined);
  }, [unread, number, client]);

  if (query.isPending) {
    return (
      <div className="flex items-center justify-center p-10 2xl:col-span-2">
        <Loader2 className="size-6 animate-spin text-ink-3" aria-hidden />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const conversation = query.data;
  const ticket = conversation.ticket;
  const closed = ticket.status === "closed";

  async function act() {
    setBusy(true);
    try {
      const updated = confirm === "close" ? await closeTicket("support", number) : await reopenTicket(number);
      applyUpdate(client, "support", updated, null);
      await query.refetch();
      await client.invalidateQueries({ queryKey: ["support", "support"], predicate: (q) => q.queryKey[2] !== "ticket" });
      toast.success(confirm === "close" ? t.admin.closedDone : t.admin.reopened);
      setConfirm(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="flex min-h-[70vh] min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={onBack} className="text-sm font-semibold text-primary lg:hidden">
            {t.back}
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {t.ticket(ticket.number)} · {ticket.store.name}
              <Badge size="sm" tone={ticket.status === "waiting_support" ? "attention" : closed ? "neutral" : "info"} dot>
                {t.admin.tabs[ticket.status] ?? t.status[ticket.status]}
              </Badge>
            </p>
            <p className="text-xs text-ink-3">{t.topics[ticket.topic]}{closed && ticket.close_reason ? ` · ${t.admin.reasons[ticket.close_reason]}` : ""}</p>
          </div>
          {closed ? (
            <Button size="sm" variant="outline" onClick={() => setConfirm("reopen")}>
              <RotateCcw />
              {t.admin.reopen}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirm("close")}>
              <Lock />
              {t.admin.close}
            </Button>
          )}
        </header>
        <Thread side="support" conversation={conversation} className="max-h-[60vh] min-h-0 flex-1 bg-bg" />
        {ticket.closes_at && !closed ? <p className="border-t border-border bg-accent-soft/60 px-3 py-1.5 text-center text-[11px] text-accent-ink">{closesText(ticket.closes_at, "support")}</p> : null}
        {closed ? (
          <p className="border-t border-border p-3 text-center text-sm text-ink-3">{t.chat.closed}</p>
        ) : (
          <Composer
            onSend={async (body, files, onProgress) => {
              const message = await sendMessage("support", number, body, files, onProgress);
              applyUpdate(client, "support", { ...ticket, status: "waiting_merchant", last_message_at: message.created_at }, message);
              void query.refetch();
              void client.invalidateQueries({ queryKey: ["support", "support"], predicate: (q) => q.queryKey[2] !== "ticket" });
            }}
          />
        )}
      </section>
      <aside className="hidden flex-col gap-4 border-s border-border p-4 text-sm 2xl:flex">
        <div>
          <p className="text-xs text-ink-3">{t.admin.store}</p>
          <p className="font-semibold">{ticket.store.name}</p>
          <Link href={`/admin/stores/${ticket.store.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <ExternalLink className="size-3.5" aria-hidden />
            {t.admin.openStore}
          </Link>
        </div>
        <dl className="grid gap-2 text-xs">
          {ticket.plan ? <Info label={t.admin.plan} value={ticket.plan} /> : null}
          {ticket.context?.page ? <Info label={t.admin.page} value={ticket.context.page} ltr /> : null}
          {ticket.context?.agent ? <Info label={t.admin.device} value={ticket.context.agent} ltr /> : null}
          {ticket.created_at ? <Info label={t.admin.opened} value={formatDateTime(ticket.created_at)} /> : null}
        </dl>
        <div>
          <p className="mb-1 text-xs text-ink-3">{t.admin.rating}</p>
          {ticket.rating ? (
            <div>
              <p className="text-accent-ink">{"★".repeat(ticket.rating)}{"☆".repeat(5 - ticket.rating)}</p>
              {ticket.rating_resolved !== null ? <p className="text-xs">{ticket.rating_resolved ? t.admin.resolvedYes : t.admin.resolvedNo}</p> : null}
              {ticket.rating_comment ? <p className="mt-1 rounded-lg bg-surface-2 p-2 text-xs">{ticket.rating_comment}</p> : null}
            </div>
          ) : (
            <p className="text-xs text-ink-3">{t.admin.noRating}</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-3">{t.admin.history}</p>
          {conversation.history && conversation.history.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {conversation.history.map((h) => (
                <li key={h.number} className="flex items-center justify-between gap-2 text-xs">
                  <Link href={`/admin/support?status=all&ticket=${h.number}`} className="font-semibold text-primary tabular">
                    {t.ticket(h.number)}
                  </Link>
                  <span className="truncate text-ink-3">{t.topics[h.topic]}</span>
                  {h.rating ? <span className="text-accent-ink">{h.rating}★</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-3">{t.admin.noHistory}</p>
          )}
        </div>
      </aside>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "reopen" ? t.admin.reopen : t.admin.closeTitle(number)}
        description={confirm === "reopen" ? t.admin.reopenText : t.admin.closeText}
        confirmLabel={confirm === "reopen" ? t.admin.reopen : t.admin.close}
        loading={busy}
        onConfirm={() => void act()}
      />
    </>
  );
}

function Info({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className={cn("break-all", ltr && "text-end")}>
        {value}
      </dd>
    </div>
  );
}

export function useSupportUnread() {
  return useQuery({ queryKey: supportKey("support", "unread"), queryFn: () => api<{ unread: number }>("/admin/support/unread") });
}
