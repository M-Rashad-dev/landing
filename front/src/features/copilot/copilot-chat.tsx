"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileSpreadsheet, ImagePlus, RotateCcw, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { MediaPicker } from "@/features/media/media-picker";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { type CopilotChat as ChatPayload, type CopilotMessage, type CopilotSheet, copilotChatKey, newCopilotChat, olderCopilotMessages, sendCopilotMessage, uploadCopilotSheet, useCopilotChat, useCopilotStatus } from "./api";
import { CopilotBlocks } from "./blocks";
import { useCopilot } from "./copilot-provider";

const t = ar.copilot;
const MAX_IMAGES = 4;

type Attachment = { id: number; url: string };

/** Light Markdown only (bold, lists, line breaks); raw HTML and images are never rendered. */
function ReplyText({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-relaxed [&_li]:ms-4 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown allowedElements={["p", "strong", "em", "ul", "ol", "li", "br", "code"]} unwrapDisallowed>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[11px] text-ink-3 hover:bg-surface-3 hover:text-ink"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {done ? t.copied : t.copy}
    </button>
  );
}

function Bubble({ message, onRetry }: { message: CopilotMessage; onRetry: () => void }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-start">
        <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-brand px-3.5 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap">{message.text}</p>
          {message.sheet ? (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[11px]">
              <FileSpreadsheet className="size-3" />
              {message.sheet.file_name} · {t.sheetRows(message.sheet.rows)}
            </p>
          ) : null}
          {message.media.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element -- the merchant's own attached image
                <img key={m.id} src={m.url} alt="" className="size-12 rounded-lg border border-white/20 object-cover" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-pink-100 text-violet-700">
        <Sparkles className="size-3.5" />
      </span>
      <div className="flex min-w-0 max-w-[88%] flex-col gap-2 rounded-2xl rounded-se-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink">
        {message.status === "pending" ? (
          <div className="flex items-center gap-2 text-ink-2" role="status">
            <span className="inline-flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-violet-600" />
              <span className="size-1.5 animate-bounce rounded-full bg-violet-600 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-violet-600 [animation-delay:300ms]" />
            </span>
            <span className="text-xs font-semibold">{message.progress ?? t.thinking}</span>
          </div>
        ) : message.status === "failed" ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-xs font-semibold text-danger">{message.error ?? t.timeout}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw className="size-3.5" />
                {t.retry}
              </Button>
              {message.error_code === "ai_balance_low" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/settings/ai">{t.topUp}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {message.text ? <ReplyText text={message.text} /> : null}
            <CopilotBlocks blocks={message.blocks} />
            {message.text ? <CopyButton text={message.text} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The copilot chat (the drawer and the full page draw the same component): messages, the composer with images, and
 * the four states (loading, empty, error, disabled). Sends the page context with each message.
 */
export function CopilotChat({ userId, className }: { userId: number; className?: string }) {
  const queryClient = useQueryClient();
  const { context } = useCopilot();
  const status = useCopilotStatus();
  const enabled = status.data?.enabled === true;
  const chat = useCopilotChat(userId, enabled);
  const [older, setOlder] = React.useState<CopilotMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = React.useState<boolean | null>(null);
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [sheet, setSheet] = React.useState<CopilotSheet | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const sheetInput = React.useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<{ code: string; message: string } | null>(null);
  const [confirmNew, setConfirmNew] = React.useState(false);
  const [startingNew, setStartingNew] = React.useState(false);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastSent = React.useRef<{ text: string; media: Attachment[] } | null>(null);

  const data = chat.data;
  const messages = React.useMemo(() => [...older, ...(data?.messages ?? [])], [older, data]);
  const hasPending = messages.some((m) => m.status === "pending");
  const lastId = messages.at(-1)?.id;
  const lastStatus = messages.at(-1)?.status;

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, lastStatus]);

  async function send(body: string, media: Attachment[]) {
    const chatId = data?.chat.id;
    if (!chatId || body.trim() === "" || sending) return;
    setSending(true);
    setSendError(null);
    lastSent.current = { text: body, media };
    try {
      const pending = await sendCopilotMessage(chatId, { text: body.trim(), media_ids: media.map((m) => m.id), import_id: sheet?.import_id, context });
      setText("");
      setAttachments([]);
      setSheet(null);
      // Show the merchant's message and the pending reply at once; the server copy replaces them on refetch.
      queryClient.setQueryData<ChatPayload>(copilotChatKey, (prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { id: pending.id - 1, role: "user", text: body.trim(), media, sheet, blocks: [], status: "done", progress: null, error: null, error_code: null, created_at: pending.created_at },
                pending,
              ],
            }
          : prev,
      );
      void queryClient.invalidateQueries({ queryKey: copilotChatKey });
    } catch (err) {
      if (isApiError(err) && err.code === "ai_reply_pending") return;
      setSendError({ code: isApiError(err) ? (err.code ?? "unknown") : "unknown", message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  }

  async function attachSheet(file: File) {
    setUploading(true);
    try {
      setSheet(await uploadCopilotSheet(file));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (sheetInput.current) sheetInput.current.value = "";
    }
  }

  async function startNew() {
    setStartingNew(true);
    try {
      const fresh = await newCopilotChat();
      queryClient.setQueryData(copilotChatKey, fresh);
      setOlder([]);
      setHasMoreOlder(null);
      setSendError(null);
      setConfirmNew(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStartingNew(false);
    }
  }

  async function loadOlder() {
    const first = messages[0];
    if (!data || !first) return;
    setLoadingOlder(true);
    try {
      const page = await olderCopilotMessages(data.chat.id, first.id);
      setOlder((prev) => [...page.messages, ...prev]);
      setHasMoreOlder(page.has_more);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  if (status.isPending || (enabled && chat.isPending)) {
    return (
      <div className={cn("flex flex-col gap-3 p-4", className)}>
        <Skeleton className="h-14 w-2/3 rounded-2xl" />
        <Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" />
        <Skeleton className="h-20 w-3/4 rounded-2xl" />
      </div>
    );
  }
  if (status.isError || chat.isError) {
    return <ErrorState className={className} message={errorMessage(status.error ?? chat.error)} onRetry={() => void (status.isError ? status.refetch() : chat.refetch())} />;
  }
  if (!enabled) {
    return <EmptyState className={className} icon={Sparkles} title={t.disabledTitle} description={t.disabledHint} />;
  }

  const showMore = hasMoreOlder ?? data?.has_more ?? false;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 text-violet-700">
              <Sparkles className="size-6" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-ink">{t.emptyTitle}</h3>
              <p className="text-xs text-ink-3">{t.emptyHint}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {t.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-brand hover:text-brand-strong"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {showMore ? (
              <Button type="button" size="sm" variant="ghost" className="self-center" loading={loadingOlder} onClick={() => void loadOlder()}>
                {t.loadMore}
              </Button>
            ) : null}
            {messages.map((m) => (
              <Bubble
                key={m.id}
                message={m}
                onRetry={() => {
                  const previous = lastSent.current;
                  const request = [...messages].reverse().find((x) => x.role === "user" && x.id < m.id);
                  void send(previous?.text ?? request?.text ?? "", previous?.media ?? []);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {sendError ? (
        <div className="px-4 pb-2">
          <Alert tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{sendError.message}</span>
              {sendError.code === "ai_balance_low" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/settings/ai">{t.topUp}</Link>
                </Button>
              ) : sendError.code === "copilot_chat_full" || sendError.code === "copilot_chat_closed" ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void startNew()}>
                  {t.newChat}
                </Button>
              ) : null}
            </div>
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border bg-surface p-3">
        {sheet ? (
          <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-ink">
            <FileSpreadsheet className="size-3.5 text-success" />
            <span className="max-w-48 truncate">{sheet.file_name}</span>
            <span className="text-ink-3">{t.sheetRows(sheet.rows)}</span>
            <button type="button" onClick={() => setSheet(null)} className="rounded p-0.5 text-ink-3 hover:text-danger" aria-label={ar.common.delete}>
              <X className="size-3" />
            </button>
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((item) => (
              <div key={item.id} className="relative size-12 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnail */}
                <img src={item.url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== item.id))}
                  className="absolute end-0.5 top-0.5 rounded bg-ink/80 p-0.5 text-white hover:bg-danger"
                  aria-label={ar.common.delete}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Button type="button" size="icon" variant="outline" disabled={attachments.length >= MAX_IMAGES || hasPending} aria-label={t.attach} onClick={() => setPickerOpen(true)}>
            <ImagePlus />
          </Button>
          <Button type="button" size="icon" variant="outline" disabled={hasPending || uploading || sheet !== null} loading={uploading} aria-label={t.attachSheet} onClick={() => sheetInput.current?.click()}>
            <FileSpreadsheet />
          </Button>
          <input
            ref={sheetInput}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            data-testid="copilot-sheet-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void attachSheet(file);
            }}
          />
          <Textarea
            rows={2}
            maxLength={2000}
            className="flex-1"
            placeholder={t.placeholder}
            value={text}
            disabled={hasPending}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text, attachments);
              }
            }}
          />
          <Button type="button" size="icon" loading={sending} disabled={!text.trim() || hasPending} aria-label={t.send} onClick={() => void send(text, attachments)}>
            <Send />
          </Button>
        </div>
        {messages.length > 0 ? (
          <button type="button" onClick={() => setConfirmNew(true)} className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-ink-3 hover:text-ink">
            <RotateCcw className="size-3" />
            {t.newChat}
          </button>
        ) : null}
      </div>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        max={MAX_IMAGES}
        already={attachments.length}
        onPick={(items) =>
          setAttachments((prev) => [...prev, ...items.filter((i) => !prev.some((p) => p.id === i.id)).map((i) => ({ id: i.id, url: i.urls.thumb ?? "" }))].slice(0, MAX_IMAGES))
        }
      />
      <ConfirmDialog
        open={confirmNew}
        onOpenChange={setConfirmNew}
        title={t.newChatConfirmTitle}
        description={t.newChatConfirmDesc}
        confirmLabel={t.newChatConfirmBtn}
        loading={startingNew}
        onConfirm={() => void startNew()}
      />
    </div>
  );
}
