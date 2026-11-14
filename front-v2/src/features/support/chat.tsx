"use client";

import { Check, CheckCheck, Film, Loader2, Paperclip, Send, Star, X } from "lucide-react";
import * as React from "react";
import { toast } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { attachmentUrl, checkFiles, IMAGE_MAX_MB, IMAGE_TYPES, loadOlder, MAX_FILES, supportKey, VIDEO_MAX_MB, VIDEO_TYPES, type Conversation, type Message, type Side } from "./api";
import { useQueryClient } from "@tanstack/react-query";

const t = ar.support;

function time(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(iso));
}

/** The messages of a conversation, newest at the bottom; keeps the view pinned to the end as messages arrive. */
export function Thread({ side, conversation, className }: { side: Side; conversation: Conversation; className?: string }) {
  const client = useQueryClient();
  const box = React.useRef<HTMLDivElement>(null);
  const [older, setOlder] = React.useState(false);
  const { ticket, messages } = conversation;
  const otherRead = side === "merchant" ? ticket.support_read_at : ticket.merchant_read_at;
  const lastOwn = [...messages].reverse().find((m) => m.sender === side);
  const count = messages.length;

  React.useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function more() {
    if (!messages[0]) return;
    setOlder(true);
    try {
      const page = await loadOlder(side, ticket.number, messages[0].id);
      client.setQueryData<Conversation>(supportKey(side, "ticket", ticket.number), (c) => (c ? { ...c, messages: [...page.messages, ...c.messages], has_more: page.has_more } : c));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setOlder(false);
    }
  }

  return (
    <div ref={box} className={cn("flex flex-col gap-2 overflow-y-auto px-3 py-4", className)} aria-live="polite">
      {conversation.has_more ? (
        <button type="button" onClick={() => void more()} disabled={older} className="mx-auto mb-2 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-2">
          {older ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : t.chat.older}
        </button>
      ) : null}
      {messages.map((m) => (
        <Bubble key={m.id} side={side} message={m} read={m.id === lastOwn?.id && !!otherRead && !!m.created_at && otherRead >= m.created_at} showStatus={m.id === lastOwn?.id} />
      ))}
    </div>
  );
}

function Bubble({ side, message, read, showStatus }: { side: Side; message: Message; read: boolean; showStatus: boolean }) {
  if (message.sender === "system") {
    return <p className="mx-auto my-1 max-w-[85%] rounded-full bg-surface-2 px-3 py-1 text-center text-xs text-ink-2">{message.body}</p>;
  }
  const own = message.sender === side;
  return (
    <div className={cn("flex max-w-[85%] flex-col gap-1", own ? "self-end items-end" : "self-start items-start")}>
      {!own && side === "merchant" ? <span className="px-1 text-[11px] font-semibold text-brand-strong">{t.name}</span> : null}
      <div className={cn("flex flex-col gap-1.5 rounded-2xl px-3 py-2 text-sm leading-relaxed", own ? "rounded-ee-md bg-primary text-white" : "rounded-es-md bg-surface-2 text-ink")}>
        {message.attachments.length > 0 ? (
          <div className={cn("grid gap-1.5", message.attachments.length > 1 && "grid-cols-2")}>
            {message.attachments.map((a) =>
              a.kind === "video" ? (
                <video key={a.id} src={attachmentUrl(side, a.id)} controls preload="metadata" className="max-h-64 w-full rounded-lg bg-black" aria-label={a.name} />
              ) : (
                <a key={a.id} href={attachmentUrl(side, a.id)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private files through the BFF */}
                  <img src={attachmentUrl(side, a.id)} alt={a.name} loading="lazy" className="max-h-56 w-full object-cover" />
                </a>
              ),
            )}
          </div>
        ) : null}
        {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
      </div>
      <span className="flex items-center gap-1 px-1 text-[10px] text-ink-3">
        {time(message.created_at)}
        {own && showStatus ? (
          read ? (
            <span className="flex items-center gap-0.5 text-brand-strong">
              <CheckCheck className="size-3" aria-hidden />
              {t.chat.read}
            </span>
          ) : (
            <span className="flex items-center gap-0.5">
              <Check className="size-3" aria-hidden />
              {t.chat.sent}
            </span>
          )
        ) : null}
      </span>
    </div>
  );
}

/** Text + images / videos; Enter sends, Shift+Enter breaks the line. */
export function Composer({ onSend, autoFocus = false, placeholder }: { onSend: (body: string, files: File[], onProgress: (p: number) => void) => Promise<void>; autoFocus?: boolean; placeholder?: string }) {
  const [body, setBody] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [progress, setProgress] = React.useState<number | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const area = React.useRef<HTMLTextAreaElement>(null);

  function add(list: FileList | File[] | null) {
    if (!list) return;
    const picked = [...files, ...Array.from(list)];
    if (picked.length > MAX_FILES) toast.error(t.compose.tooMany);
    const next = picked.slice(0, MAX_FILES);
    for (const p of checkFiles(next)) toast.error(p.problem === "type" ? t.compose.badType(p.file.name) : t.compose.tooBig(p.file.name, IMAGE_TYPES.includes(p.file.type) ? IMAGE_MAX_MB : VIDEO_MAX_MB));
    const bad = new Set(checkFiles(next).map((p) => p.file));
    setFiles(next.filter((f) => !bad.has(f)));
  }

  async function send() {
    if (progress !== null || (!body.trim() && files.length === 0)) return;
    setProgress(0);
    try {
      await onSend(body, files, setProgress);
      setBody("");
      setFiles([]);
      area.current?.focus();
    } catch (e) {
      toast.error(errorMessage(e) || t.chat.failed);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div
      className="border-t border-border bg-surface p-2.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        add(e.dataTransfer.files);
      }}
    >
      {files.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-xs">
              {VIDEO_TYPES.includes(f.type) ? <Film className="size-3.5 shrink-0" aria-hidden /> : <Paperclip className="size-3.5 shrink-0" aria-hidden />}
              <span className="max-w-40 truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label={`${t.compose.remove}: ${f.name}`} className="text-ink-3 hover:text-danger">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => input.current?.click()} aria-label={t.compose.attach} title={t.compose.filesHint} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
          <Paperclip className="size-5" aria-hidden />
        </button>
        <input ref={input} type="file" multiple accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")} className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        <textarea
          ref={area}
          value={body}
          autoFocus={autoFocus}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              add(e.clipboardData.files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={5000}
          placeholder={placeholder ?? t.compose.placeholder}
          aria-label={t.compose.message}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand [field-sizing:content]"
        />
        <button type="button" onClick={() => void send()} disabled={progress !== null || (!body.trim() && files.length === 0)} aria-label={t.compose.send} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity disabled:opacity-40">
          {progress !== null ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
        </button>
      </div>
      {progress !== null && files.length > 0 ? <p className="mt-1.5 text-xs text-ink-3">{t.compose.sending(progress)}</p> : null}
    </div>
  );
}

/** Stars, "was it solved?" and a comment, once the conversation is closed. */
export function RatingForm({ onRate }: { onRate: (rating: number, resolved: boolean, comment: string) => Promise<void> }) {
  const [stars, setStars] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [resolved, setResolved] = React.useState<boolean | null>(null);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!stars || resolved === null) return;
    setBusy(true);
    try {
      await onRate(stars, resolved, comment);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-surface p-4">
      <p className="text-center text-sm font-semibold">{t.rating.title}</p>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label={t.rating.title} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t.rating.stars(n)} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)} className="p-0.5">
            <Star className={cn("size-8 transition-colors", (hover || stars) >= n ? "fill-accent text-accent" : "text-border-strong")} aria-hidden />
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-sm">
        <span>{t.rating.resolved}</span>
        {[true, false].map((v) => (
          <button key={String(v)} type="button" aria-pressed={resolved === v} onClick={() => setResolved(v)} className={cn("h-8 rounded-lg border px-3 font-semibold", resolved === v ? "border-primary bg-brand-soft text-brand-strong" : "border-border")}>
            {v ? t.rating.yes : t.rating.no}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder={t.rating.comment} aria-label={t.rating.comment} className="resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
      <button type="button" onClick={() => void submit()} disabled={!stars || resolved === null || busy} className="h-10 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-40">
        {t.rating.send}
      </button>
    </div>
  );
}

export function closesText(iso: string, side: Side = "merchant"): string {
  return side === "support" ? t.chat.closesAtSupport(formatDateTime(iso)) : t.chat.closesAt(formatDateTime(iso));
}
