"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ExternalLink,
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent } from "@/components/ui/overlay";
import type { MediaItem } from "@/features/media/api";
import { MediaPicker } from "@/features/media/media-picker";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import type { AiDefinition, AiSectionRuntimeData, AiTokens } from "@/themes/shared/ai-section/types";
import { FONTS, type FontKey, type MediaUrls } from "@/themes/shared/design";
import {
  ACTIVE_RUN_STATUSES,
  applyDesignRun,
  approveVersion,
  designerChatKey,
  designRunKey,
  mySectionsKey,
  newChat,
  openChat,
  rejectDesignRun,
  rejectVersion,
  revertDesignRun,
  sendMessage,
  startDesignRun,
  useChat,
  type AiChatMessagePayload,
  type AiMessageMedia,
  type AiRunPayload,
  type AiVersionPayload,
} from "./api";
import { PreviewDialog } from "./preview-dialog";
import { RunPreviewDialog } from "./run-preview-dialog";

const t = ar.aiDesigner;

export type FocusedAiSection = {
  id: number;
  name: string;
  values?: Record<string, unknown>;
};

export function DesignerDialog({
  open,
  onOpenChange,
  kind,
  themeKey,
  landingPageId = null,
  focusSection: initialFocus = null,
  tokens,
  data,
  designVersion = 1,
  canUseImage = false,
  onUseImage,
  onApproved,
  onDesignUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "store" | "landing";
  themeKey: string;
  landingPageId?: number | null;
  focusSection?: FocusedAiSection | null;
  tokens: AiTokens;
  data?: AiSectionRuntimeData;
  designVersion?: number;
  canUseImage?: boolean;
  onUseImage?: (media: AiMessageMedia) => void;
  onApproved: (
    section: { id: number; name: string; current: AiDefinition },
    isNew: boolean,
    chatMedia?: Record<string, MediaUrls>,
  ) => void;
  onDesignUpdated?: () => Promise<void> | void;
}) {
  const client = useQueryClient();
  const [chatId, setChatId] = React.useState<number | null>(null);
  const [loadingChat, setLoadingChat] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [focus, setFocus] = React.useState<FocusedAiSection | null>(initialFocus);
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<MediaItem[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<{
    code: string;
    message: string;
  } | null>(null);

  const [confirmNewOpen, setConfirmNewOpen] = React.useState(false);
  const [startingNew, setStartingNew] = React.useState(false);

  const [previewVersion, setPreviewVersion] = React.useState<AiVersionPayload | null>(null);
  const [deciding, setDeciding] = React.useState(false);

  const [customSwitches, setCustomSwitches] = React.useState<
    Record<number, Record<string, boolean>>
  >({});
  const [startingRunMsgId, setStartingRunMsgId] = React.useState<number | null>(null);
  const [previewRunId, setPreviewRunId] = React.useState<number | null>(null);
  const [runBusy, setRunBusy] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Opening (again) starts from the place it was opened from; adjusted while rendering, not in an effect.
  const [openedWith, setOpenedWith] = React.useState<{ open: boolean; focus: typeof initialFocus }>({ open: false, focus: initialFocus });
  if (openedWith.open !== open || openedWith.focus !== initialFocus) {
    setOpenedWith({ open, focus: initialFocus });
    if (open) {
      setFocus(initialFocus);
      setSendError(null);
    }
  }
  // The clock for «the reply is late» (read in render, ticks in an effect).
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, [open]);

  const initChat = React.useCallback(async () => {
    setLoadingChat(true);
    setLoadError(null);
    try {
      const res = await openChat({
        kind,
        theme_key: themeKey,
        landing_page_id: kind === "landing" ? landingPageId : null,
      });
      setChatId(res.chat.id);
      client.setQueryData(designerChatKey(res.chat.id), res);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoadingChat(false);
    }
  }, [kind, themeKey, landingPageId, client]);

  React.useEffect(() => {
    if (!open) return;
    // Started right after the effect, so its state updates aren't synchronous inside it.
    const id = window.setTimeout(() => void initChat(), 0);
    return () => window.clearTimeout(id);
  }, [open, initChat]);

  React.useEffect(() => {
    if (open && !loadingChat) {
      const id = window.setTimeout(() => textareaRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open, loadingChat]);

  const chatQuery = useChat(chatId, open && chatId !== null);
  const messages = React.useMemo(() => chatQuery.data?.messages ?? [], [chatQuery.data?.messages]);
  const hasPending = messages.some((m) => m.status === "pending");
  const hasActiveRun = messages.some(
    (m) => m.run && ACTIVE_RUN_STATUSES.includes(m.run.status),
  );

  const chatMedia = React.useMemo<Record<string, MediaUrls>>(() => {
    const out: Record<string, MediaUrls> = {};
    for (const m of messages) {
      for (const img of m.media) {
        if (img.urls) {
          out[String(img.id)] = img.urls;
        }
      }
    }
    return out;
  }, [messages]);

  const mergedData = React.useMemo<AiSectionRuntimeData>(
    () => ({
      ...data,
      media: { ...data?.media, ...chatMedia },
    }),
    [data, chatMedia],
  );

  const chatMediaCount = Object.keys(chatMedia).length;
  React.useEffect(() => {
    if (chatMediaCount > 0) {
      void client.invalidateQueries({ queryKey: ["media"] });
    }
  }, [chatMediaCount, client]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, hasPending, hasActiveRun]);

  async function handleStartNewChat() {
    setStartingNew(true);
    try {
      const res = await newChat({
        kind,
        theme_key: themeKey,
        landing_page_id: kind === "landing" ? landingPageId : null,
      });
      setChatId(res.chat.id);
      client.setQueryData(designerChatKey(res.chat.id), res);
      setSendError(null);
      setConfirmNewOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStartingNew(false);
    }
  }

  async function handleSend(customPayload?: {
    text: string;
    media_ids: number[];
    focus_section_id: number | null;
  }) {
    if (!chatId || sending || hasPending) return;
    const bodyText = (customPayload ? customPayload.text : text).trim();
    if (!bodyText) return;

    const mediaIds = customPayload ? customPayload.media_ids : attachments.map((m) => m.id);
    const focusId = customPayload ? customPayload.focus_section_id : (focus?.id ?? null);

    setSending(true);
    setSendError(null);
    try {
      await sendMessage(chatId, {
        text: bodyText,
        media_ids: mediaIds,
        focus_section_id: focusId,
      });
      if (!customPayload) {
        setText("");
        setAttachments([]);
      }
      await chatQuery.refetch();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "ai_reply_pending") {
          await chatQuery.refetch();
          return;
        }
        setSendError({
          code: err.code,
          message:
            err.code === "ai_balance_low"
              ? t.chat.balanceLow
              : err.code === "ai_unavailable"
                ? t.chat.unavailable
                : err.code === "ai_chat_full"
                  ? t.chat.chatFull
                  : errorMessage(err),
        });
      } else {
        setSendError({ code: "unknown", message: errorMessage(err) });
      }
    } finally {
      setSending(false);
    }
  }

  function handleRetry(failedAssistantMsg: AiChatMessagePayload) {
    const idx = messages.findIndex((m) => m.id === failedAssistantMsg.id);
    let prevUser: AiChatMessagePayload | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        prevUser = messages[i]!;
        break;
      }
    }
    if (!prevUser || !prevUser.text) return;
    void handleSend({
      text: prevUser.text,
      media_ids: prevUser.media.map((m) => m.id),
      focus_section_id: prevUser.focus_section_id,
    });
  }

  async function handleApprove(version: AiVersionPayload) {
    setDeciding(true);
    try {
      const isNew = version.ai_section_id === null;
      const res = await approveVersion(version.id);
      setPreviewVersion(null);
      await chatQuery.refetch();
      await client.invalidateQueries({ queryKey: mySectionsKey(kind, themeKey) });
      toast.success(isNew ? t.version.approvedNewToast : t.version.approvedEditToast);
      onApproved(res.section, isNew, chatMedia);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeciding(false);
    }
  }

  async function handleReject(version: AiVersionPayload) {
    setDeciding(true);
    try {
      await rejectVersion(version.id);
      setPreviewVersion(null);
      await chatQuery.refetch();
      toast.info(t.version.rejectedToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeciding(false);
    }
  }

  async function handleStartRun(msg: AiChatMessagePayload) {
    if (!msg.plan || startingRunMsgId !== null || hasActiveRun) return;
    const switchesForMsg: Record<string, boolean> = {};
    for (const sec of msg.plan.sections) {
      if (sec.type === "custom" && sec.key) {
        switchesForMsg[sec.key] =
          customSwitches[msg.id]?.[sec.key] ?? (sec.enabled ?? true);
      }
    }

    setStartingRunMsgId(msg.id);
    setSendError(null);
    try {
      await startDesignRun(msg.id, switchesForMsg);
      await chatQuery.refetch();
    } catch (err) {
      if (isApiError(err)) {
        setSendError({
          code: err.code,
          message:
            err.code === "ai_balance_low"
              ? t.chat.balanceLow
              : err.code === "ai_unavailable"
                ? t.chat.unavailable
                : errorMessage(err),
        });
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setStartingRunMsgId(null);
    }
  }

  async function handleApplyRun(run: AiRunPayload) {
    setRunBusy(true);
    try {
      await applyDesignRun(run.id, designVersion);
      setPreviewRunId(null);
      await chatQuery.refetch();
      await client.invalidateQueries({ queryKey: designRunKey(run.id) });
      await client.invalidateQueries({ queryKey: mySectionsKey(kind, themeKey) });
      await onDesignUpdated?.();
      toast.success(t.run.appliedToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunBusy(false);
    }
  }

  async function handleRejectRun(run: AiRunPayload) {
    setRunBusy(true);
    try {
      await rejectDesignRun(run.id);
      setPreviewRunId(null);
      await chatQuery.refetch();
      await client.invalidateQueries({ queryKey: designRunKey(run.id) });
      toast.info(t.run.rejectedToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunBusy(false);
    }
  }

  async function handleRevertRun(run: AiRunPayload) {
    setRunBusy(true);
    try {
      await revertDesignRun(run.id, designVersion);
      await chatQuery.refetch();
      await client.invalidateQueries({ queryKey: designRunKey(run.id) });
      await onDesignUpdated?.();
      toast.success(t.run.revertedToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="lg"
          className="flex h-dvh w-screen max-w-none flex-col rounded-none p-0 sm:h-[85vh] sm:max-w-3xl sm:rounded-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-ink">{t.chat.title}</h2>
                <p className="text-xs text-ink-3">{t.chat.subtitle}</p>
              </div>
            </div>
            {messages.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmNewOpen(true)}
              >
                <RotateCcw className="size-3.5" />
                {t.chat.newChat}
              </Button>
            ) : null}
          </div>

          <DialogBody className="flex min-h-0 flex-1 flex-col p-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
              {loadingChat ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-16 w-2/3 rounded-2xl" />
                  <Skeleton className="ms-auto h-20 w-3/4 rounded-2xl" />
                </div>
              ) : loadError ? (
                <ErrorState message={loadError} onRetry={() => void initChat()} />
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 text-violet-700">
                    <Sparkles className="size-7" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-ink">{t.chat.emptyTitle}</h3>
                    <p className="text-xs text-ink-3">{t.chat.emptyHint}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {t.chat.examples.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setText(ex)}
                        className="rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-ink-2 transition hover:border-brand hover:bg-brand-soft/30 hover:text-brand-strong"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg) => {
                    if (msg.role === "user") {
                      return (
                        <div key={msg.id} className="flex flex-col items-start gap-1.5">
                          <div className="max-w-[80%] rounded-2xl rounded-ss-sm bg-brand px-4 py-2.5 text-sm text-white shadow-xs">
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            {msg.media.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {msg.media.map((m) => (
                                  // eslint-disable-next-line @next/next/no-img-element -- user reference image
                                  <img
                                    key={m.id}
                                    src={m.url}
                                    alt=""
                                    className="size-14 rounded-lg border border-white/20 object-cover"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    const isTimedOut =
                      msg.status === "pending" &&
                      msg.created_at &&
                      now - Date.parse(msg.created_at) > 180_000;

                    return (
                      <div key={msg.id} className="flex items-start gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-pink-100 text-violet-700">
                          <Sparkles className="size-4" />
                        </span>
                        <div className="flex max-w-[85%] flex-col gap-2.5 rounded-2xl rounded-se-sm border border-border bg-surface-2 px-4 py-3 text-sm text-ink">
                          {msg.status === "pending" && !isTimedOut ? (
                            <div className="flex items-center gap-2 text-ink-2">
                              <span className="inline-flex gap-1">
                                <span className="size-1.5 animate-bounce rounded-full bg-violet-600" />
                                <span className="size-1.5 animate-bounce rounded-full bg-violet-600 [animation-delay:150ms]" />
                                <span className="size-1.5 animate-bounce rounded-full bg-violet-600 [animation-delay:300ms]" />
                              </span>
                              <span className="text-xs font-semibold">{t.chat.thinking}</span>
                            </div>
                          ) : msg.status === "failed" || isTimedOut ? (
                            <div className="flex flex-col items-start gap-2">
                              <p className="text-xs font-semibold text-danger">
                                {msg.error ?? t.chat.timeout}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetry(msg)}
                              >
                                <RotateCcw className="size-3.5" />
                                {t.chat.retry}
                              </Button>
                            </div>
                          ) : (
                            <>
                              {msg.text ? <p className="whitespace-pre-wrap">{msg.text}</p> : null}

                              {msg.media.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                  {msg.media.map((img) => {
                                    const displayUrl = img.urls?.medium ?? img.urls?.large ?? img.url;
                                    const showUseBtn = Boolean(onUseImage && (focus !== null || canUseImage));
                                    return (
                                      <div
                                        key={img.id}
                                        className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xs"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element -- AI generated/edited media */}
                                        <img
                                          src={displayUrl}
                                          alt=""
                                          className="h-36 w-full bg-surface-2 object-cover"
                                        />
                                        <div className="flex flex-wrap items-center gap-1.5 p-2">
                                          {showUseBtn ? (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="primary"
                                              className="flex-1 text-xs"
                                              onClick={() => onUseImage?.(img)}
                                            >
                                              <Check className="size-3.5" />
                                              {t.images.useInSection}
                                            </Button>
                                          ) : null}
                                          <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
                                            <Link href="/dashboard/media" target="_blank">
                                              <ExternalLink className="size-3.5" />
                                              {t.images.openLibrary}
                                            </Link>
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {msg.version ? (
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                                  <div className="flex min-w-0 flex-col gap-1">
                                    <span className="truncate text-sm font-bold text-ink">
                                      {msg.version.name}
                                    </span>
                                    <Badge
                                      size="sm"
                                      tone={
                                        msg.version.status === "approved"
                                          ? "success"
                                          : msg.version.status === "rejected"
                                            ? "danger"
                                            : "brand"
                                      }
                                    >
                                      {t.version.statuses[msg.version.status]}
                                    </Badge>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={msg.version.status === "proposed" ? "primary" : "outline"}
                                    onClick={() => setPreviewVersion(msg.version)}
                                  >
                                    <Eye className="size-4" />
                                    {t.version.preview}
                                  </Button>
                                </div>
                              ) : null}

                              {msg.plan ? (
                                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-ink">{t.plan.title}</span>
                                    {msg.plan.style.dark ? (
                                      <Badge size="sm" tone="brand">
                                        {t.plan.dark}
                                      </Badge>
                                    ) : null}
                                  </div>

                                  {msg.plan.summary ? (
                                    <p className="text-xs text-ink-2">{msg.plan.summary}</p>
                                  ) : null}

                                  {/* Style swatches + font + mood */}
                                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-ink-3">{t.plan.colors}:</span>
                                      {(
                                        [
                                          msg.plan.style.colors.primary,
                                          msg.plan.style.colors.secondary,
                                          msg.plan.style.colors.background,
                                          msg.plan.style.colors.text,
                                        ] as const
                                      ).map((hex, ci) => (
                                        <span
                                          key={ci}
                                          title={hex}
                                          className="size-4 rounded-full border border-border shadow-2xs"
                                          style={{ backgroundColor: hex }}
                                        />
                                      ))}
                                    </div>
                                    <span className="h-3.5 w-px bg-border" aria-hidden />
                                    <span>
                                      <strong className="text-ink-3">{t.plan.font}: </strong>
                                      {FONTS[msg.plan.style.font as FontKey]?.label ?? msg.plan.style.font}
                                    </span>
                                    <span className="h-3.5 w-px bg-border" aria-hidden />
                                    <span>
                                      <strong className="text-ink-3">{t.plan.mood}: </strong>
                                      {msg.plan.style.mood}
                                    </span>
                                  </div>

                                  {/* Sections list */}
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-bold text-ink-2">
                                      {t.plan.sectionsTitle}
                                    </span>
                                    <ol className="flex flex-col gap-1.5">
                                      {msg.plan.sections.map((sec, si) => (
                                        <li
                                          key={`${sec.type}-${sec.key ?? si}`}
                                          className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-ink">
                                              {si + 1}. {sec.title}
                                            </span>
                                            {sec.type === "custom" ? (
                                              <Badge size="sm" tone="brand">
                                                {t.plan.customBadge}
                                              </Badge>
                                            ) : null}
                                          </div>
                                          {sec.purpose || sec.request ? (
                                            <span className="text-ink-3">
                                              {sec.purpose ?? sec.request}
                                            </span>
                                          ) : null}
                                          {sec.type === "custom" && sec.key ? (
                                            <SwitchRow
                                              title={t.plan.customToggleLabel(sec.title)}
                                              checked={
                                                customSwitches[msg.id]?.[sec.key] ??
                                                (sec.enabled ?? true)
                                              }
                                              disabled={Boolean(
                                                msg.run &&
                                                  msg.run.status !== "failed" &&
                                                  msg.run.status !== "rejected",
                                              )}
                                              onCheckedChange={(checked) =>
                                                setCustomSwitches((prev) => ({
                                                  ...prev,
                                                  [msg.id]: {
                                                    ...(prev[msg.id] ?? {}),
                                                    [sec.key!]: checked,
                                                  },
                                                }))
                                              }
                                            />
                                          ) : null}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>

                                  {/* Images work list */}
                                  {msg.plan.images.length > 0 ? (
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-xs font-bold text-ink-2">
                                        {t.plan.imagesTitle}
                                      </span>
                                      <ul className="flex flex-col gap-1">
                                        {msg.plan.images.map((im) => (
                                          <li
                                            key={im.id}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs"
                                          >
                                            <span className="truncate text-ink">
                                              {im.use || im.prompt || im.id}
                                            </span>
                                            <Badge size="sm">
                                              {t.plan.imageActions[im.action] ?? im.action}
                                            </Badge>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {msg.plan.notes ? (
                                    <p className="text-xs text-ink-3">{msg.plan.notes}</p>
                                  ) : null}

                                  {/* Plan actions */}
                                  {!msg.run ||
                                  msg.run.status === "failed" ||
                                  msg.run.status === "rejected" ? (
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        loading={startingRunMsgId === msg.id}
                                        disabled={hasActiveRun || hasPending}
                                        onClick={() => void handleStartRun(msg)}
                                      >
                                        <Play className="size-3.5" />
                                        {t.plan.runButton}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => textareaRef.current?.focus()}
                                      >
                                        <Pencil className="size-3.5" />
                                        {t.plan.editButton}
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              {msg.run ? (
                                <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-ink">
                                      {t.run.title}
                                    </span>
                                    <Badge
                                      size="sm"
                                      tone={
                                        msg.run.status === "applied"
                                          ? "success"
                                          : msg.run.status === "failed" ||
                                              msg.run.status === "rejected"
                                            ? "danger"
                                            : "brand"
                                      }
                                    >
                                      {msg.run.reverted_at
                                        ? t.run.revertedBadge
                                        : t.run.statuses[msg.run.status]}
                                    </Badge>
                                  </div>

                                  {ACTIVE_RUN_STATUSES.includes(msg.run.status) ? (
                                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
                                      <Loader2 className="size-4 animate-spin" />
                                      <span>
                                        {msg.run.progress ?? t.run.statuses[msg.run.status]}
                                      </span>
                                    </div>
                                  ) : msg.run.status === "failed" ? (
                                    <div className="flex flex-col items-start gap-2">
                                      <p className="text-xs font-semibold text-danger">
                                        {msg.run.error ?? t.chat.unavailable}
                                      </p>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handleStartRun(msg)}
                                      >
                                        <RotateCcw className="size-3.5" />
                                        {t.chat.retry}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      {msg.run.status === "proposed" ||
                                      msg.run.status === "applied" ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={
                                            msg.run.status === "proposed" ? "primary" : "outline"
                                          }
                                          onClick={() => setPreviewRunId(msg.run!.id)}
                                        >
                                          <Eye className="size-4" />
                                          {t.run.previewButton}
                                        </Button>
                                      ) : null}

                                      {msg.run.can_revert ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          loading={runBusy}
                                          onClick={() => void handleRevertRun(msg.run!)}
                                        >
                                          <Undo2 className="size-4" />
                                          {t.run.revertButton}
                                        </Button>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {sendError ? (
              <div className="px-5 pb-2">
                <Alert tone="danger">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{sendError.message}</span>
                    {sendError.code === "ai_balance_low" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/settings/ai" target="_blank">
                          {t.chat.topUpLink}
                        </Link>
                      </Button>
                    ) : sendError.code === "ai_chat_full" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleStartNewChat()}
                      >
                        {t.chat.newChat}
                      </Button>
                    ) : null}
                  </div>
                </Alert>
              </div>
            ) : null}

            {/* Composer */}
            <div className="flex flex-col gap-2 border-t border-border bg-surface p-4">
              {focus ? (
                <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-1.5 text-xs font-semibold text-violet-800">
                  <span>{t.chat.editingChip(focus.name)}</span>
                  <button
                    type="button"
                    onClick={() => setFocus(null)}
                    aria-label={t.chat.clearFocus}
                    className="rounded p-0.5 hover:bg-violet-200/60"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((item) => (
                    <div
                      key={item.id}
                      className="relative size-14 overflow-hidden rounded-lg border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnail */}
                      <img src={item.urls.thumb} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((x) => x.id !== item.id))
                        }
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
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={attachments.length >= 6 || sending || hasPending}
                  aria-label={t.chat.attach}
                  onClick={() => setPickerOpen(true)}
                >
                  <ImagePlus className="size-4" />
                </Button>
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    rows={2}
                    maxLength={2000}
                    placeholder={t.chat.placeholder}
                    value={text}
                    disabled={sending || hasPending}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  loading={sending}
                  disabled={!text.trim() || hasPending}
                  onClick={() => void handleSend()}
                >
                  <Send className="size-4" />
                  {t.chat.send}
                </Button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        max={6}
        already={attachments.length}
        onPick={(items) =>
          setAttachments((prev) =>
            [...prev, ...items.filter((i) => !prev.some((p) => p.id === i.id))].slice(0, 6),
          )
        }
      />

      <ConfirmDialog
        open={confirmNewOpen}
        onOpenChange={setConfirmNewOpen}
        title={t.chat.newChatConfirmTitle}
        description={t.chat.newChatConfirmDesc}
        confirmLabel={t.chat.newChatConfirmBtn}
        loading={startingNew}
        onConfirm={() => void handleStartNewChat()}
      />

      <PreviewDialog
        version={previewVersion}
        open={previewVersion !== null}
        onOpenChange={(o) => !o && setPreviewVersion(null)}
        kind={kind}
        tokens={tokens}
        values={
          previewVersion?.ai_section_id && focus?.id === previewVersion.ai_section_id
            ? (focus.values ?? {})
            : {}
        }
        data={mergedData}
        busy={deciding}
        onApprove={(v) => void handleApprove(v)}
        onReject={(v) => void handleReject(v)}
      />

      <RunPreviewDialog
        runId={previewRunId}
        open={previewRunId !== null}
        onOpenChange={(o) => !o && setPreviewRunId(null)}
        kind={kind}
        themeKey={themeKey}
        busy={runBusy}
        onApply={(run) => void handleApplyRun(run)}
        onReject={(run) => void handleRejectRun(run)}
      />
    </>
  );
}
