"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Headset, Loader2, MessageCirclePlus, MoreVertical, X } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Alert, ErrorState, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { applyUpdate, closeTicket, markRead, openTicket, rateTicket, sendMessage, supportKey, useConversation, useMerchantTickets, useSummary, useSupportLive, type Conversation, type Ticket } from "./api";
import { closesText, Composer, RatingForm, Thread } from "./chat";

const t = ar.support;
const TOPICS = ["orders", "billing", "domain", "design", "products", "technical", "other"];
type View = { name: "list" } | { name: "new" } | { name: "chat"; number: number };

/**
 * The support bubble in the corner of the store's dashboard: the merchant's conversations with
 * «الدعم», a new one, and the chat itself (live through Reverb).
 */
export function SupportWidget({ tenantId }: { tenantId: number }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<View>({ name: "list" });
  const summary = useSummary();
  const live = useSupportLive("merchant", tenantId);
  const unread = summary.data?.unread ?? 0;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <section role="dialog" aria-label={t.name} className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg shadow-2xl sm:inset-auto sm:bottom-24 sm:end-5 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[390px] sm:rounded-2xl sm:border sm:border-border">
          <header className="flex items-center gap-2 bg-primary px-3 py-3 text-white">
            {view.name !== "list" ? (
              <button type="button" onClick={() => setView({ name: "list" })} aria-label={t.back} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15">
                <ArrowRight className="size-5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
              </button>
            ) : (
              <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                <Headset className="size-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold">{view.name === "chat" ? `${t.name} · ${t.ticket(view.number)}` : t.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <span className={cn("size-1.5 rounded-full", live ? "bg-brand" : "bg-white/50")} aria-hidden />
                {t.available}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15">
              <X className="size-5" aria-hidden />
            </button>
          </header>
          {view.name === "list" ? <TicketList onOpen={(n) => setView({ name: "chat", number: n })} onNew={() => setView({ name: "new" })} /> : null}
          {view.name === "new" ? <NewTicket onOpened={(n) => setView({ name: "chat", number: n })} /> : null}
          {view.name === "chat" ? <MerchantChat number={view.number} /> : null}
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.bubble}
        aria-expanded={open}
        className={cn("fixed bottom-5 end-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95", open && "max-sm:hidden")}
      >
        {open ? <X className="size-6" aria-hidden /> : <Headset className="size-6" aria-hidden />}
        {unread > 0 && !open ? <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold">{unread}</span> : null}
      </button>
    </>
  );
}

function TicketList({ onOpen, onNew }: { onOpen: (n: number) => void; onNew: () => void }) {
  const tickets = useMerchantTickets(true);
  const summary = useSummary();
  const canOpen = summary.data?.can_open ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tickets.isPending ? (
          <div className="flex justify-center p-8">
            <Loader2 className="size-6 animate-spin text-ink-3" aria-hidden />
          </div>
        ) : tickets.isError ? (
          <ErrorState onRetry={() => void tickets.refetch()} message={errorMessage(tickets.error)} />
        ) : tickets.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <Headset className="size-7" aria-hidden />
            </span>
            <p className="font-semibold">{t.list.empty}</p>
            <p className="text-sm text-ink-2">{t.list.emptyText}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tickets.data.map((ticket) => (
              <li key={ticket.number}>
                <TicketRow ticket={ticket} onOpen={() => onOpen(ticket.number)} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border p-3">
        {!canOpen && summary.data?.reason ? <p className="mb-2 text-xs text-ink-3">{summary.data.reason}</p> : null}
        <button type="button" onClick={onNew} disabled={!canOpen} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-40">
          <MessageCirclePlus className="size-4" aria-hidden />
          {t.list.new}
        </button>
      </div>
    </div>
  );
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const last = ticket.last_message;
  const preview = last ? `${last.sender === "merchant" ? `${t.list.you} ` : ""}${last.preview || (last.files ? t.list.files(last.files) : "")}` : "";
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-surface-2/60">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-bold tabular">{t.ticket(ticket.number)}</span>
          <span className="text-ink-2">{t.topics[ticket.topic]}</span>
        </p>
        <p className={cn("truncate text-sm", ticket.unread_merchant ? "font-semibold text-ink" : "text-ink-3")}>{preview}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3">
          <span className={cn("rounded px-1.5 py-0.5 font-semibold", ticket.status === "waiting_merchant" ? "bg-accent-soft text-accent-ink" : ticket.status === "closed" ? "bg-surface-2 text-ink-3" : "bg-info-soft text-info")}>{t.status[ticket.status]}</span>
          {ticket.last_message_at ? formatDateTime(ticket.last_message_at) : null}
        </p>
      </div>
      {ticket.unread_merchant ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-danger" aria-hidden /> : null}
    </button>
  );
}

function NewTicket({ onOpened }: { onOpened: (n: number) => void }) {
  const client = useQueryClient();
  const pathname = usePathname();
  const [topic, setTopic] = React.useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-2 text-sm font-semibold">{t.compose.topic}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.compose.topic}>
          {TOPICS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={topic === k} onClick={() => setTopic(k)} className={cn("h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors", topic === k ? "border-primary bg-brand-soft text-brand-strong" : "border-border hover:bg-surface-2")}>
              {t.topics[k]}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-3">{t.compose.hint}</p>
        <p className="mt-1 text-xs text-ink-3">{t.compose.filesHint}</p>
      </div>
      {topic ? (
        <Composer
          autoFocus
          onSend={async (body, files, onProgress) => {
            const created = await openTicket(topic, body, files, pathname, onProgress);
            client.setQueryData(supportKey("merchant", "ticket", created.ticket.number), created);
            await client.invalidateQueries({ queryKey: ["support", "merchant"], predicate: (q) => q.queryKey[2] !== "ticket" });
            onOpened(created.ticket.number);
          }}
        />
      ) : null}
    </div>
  );
}

function MerchantChat({ number }: { number: number }) {
  const client = useQueryClient();
  const query = useConversation("merchant", number);
  const [closing, setClosing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ticket = query.data?.ticket;
  const unread = ticket?.unread_merchant ?? false;

  // Seen: everything up to now (the other side shows «اتقرت»).
  React.useEffect(() => {
    if (!unread) return;
    void markRead("merchant", number)
      .then((updated) => {
        applyUpdate(client, "merchant", updated, null);
        void client.invalidateQueries({ queryKey: supportKey("merchant", "summary") });
        void client.invalidateQueries({ queryKey: supportKey("merchant", "list") });
      })
      .catch(() => undefined);
  }, [unread, number, client]);

  if (query.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-ink-3" aria-hidden />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const conversation: Conversation = query.data;
  const current = conversation.ticket;
  const closed = current.status === "closed";

  async function close() {
    setBusy(true);
    try {
      const updated = await closeTicket("merchant", number);
      applyUpdate(client, "merchant", updated, null);
      await query.refetch();
      setClosing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="font-semibold">{t.topics[current.topic]}</span>
        <span className="text-ink-3">· {t.status[current.status]}</span>
        {!closed ? (
          <Menu>
            <MenuTrigger asChild>
              <button type="button" aria-label={t.chat.closeAction} className="ms-auto rounded-md p-1 text-ink-3 hover:bg-surface-2">
                <MoreVertical className="size-4" aria-hidden />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setClosing(true)}>{t.chat.closeAction}</MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
      </div>
      <Thread side="merchant" conversation={conversation} className="min-h-0 flex-1" />
      {current.closes_at && !closed ? <p className="border-t border-border bg-accent-soft/60 px-3 py-1.5 text-center text-[11px] text-accent-ink">{closesText(current.closes_at)}</p> : null}
      {closed ? (
        current.rating ? (
          <div className="border-t border-border p-3 text-center text-sm">
            <p className="font-semibold text-brand-strong">{t.rating.thanks}</p>
            <p className="text-accent-ink">{t.rating.yours(current.rating)}</p>
            <p className="mt-1 text-xs text-ink-3">{t.chat.closedHint}</p>
          </div>
        ) : (
          <>
            <Alert tone="info" className="m-3 mb-0">
              {t.chat.closed}
            </Alert>
            <RatingForm
              onRate={async (rating, resolved, comment) => {
                const updated = await rateTicket(number, rating, resolved, comment);
                applyUpdate(client, "merchant", updated, null);
              }}
            />
          </>
        )
      ) : (
        <Composer
          onSend={async (body, files, onProgress) => {
            const message = await sendMessage("merchant", number, body, files, onProgress);
            applyUpdate(client, "merchant", { ...current, status: "waiting_support", closes_at: null, last_message_at: message.created_at }, message);
          }}
        />
      )}
      <ConfirmDialog open={closing} onOpenChange={setClosing} title={t.chat.closeTitle} description={t.chat.closeText} confirmLabel={t.chat.closeAction} loading={busy} onConfirm={() => void close()} />
    </div>
  );
}
