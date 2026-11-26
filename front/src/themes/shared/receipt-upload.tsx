"use client";

import { Check, Copy, ExternalLink, FileUp, Loader2, Paperclip, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { ImageRejected, prepareImage } from "@/lib/media/compress";
import { ar } from "@/messages/ar";

const t = ar.storefront.pay;
const MAX_BYTES = 10 * 1024 * 1024;

/** A store's transfer method as the customer sees it (back: StorePaymentMethod::publicView). */
export type TransferMethod = { id: number; kind: string; name: string; account?: string | null; link?: string | null; instructions?: string | null };

/** What the customer filled under a transfer method at checkout: the receipt (ready to send) and who sent it. */
export type ReceiptDraft = { file: File | null; sender: string };

/** A picked receipt, ready to send: an image is shrunk (EXIF dropped), a PDF goes as it is. */
export async function readyReceipt(raw: File): Promise<File> {
  if (raw.type === "application/pdf") {
    if (raw.size > MAX_BYTES) throw new ImageRejected("size", raw.name);
    return raw;
  }
  return prepareImage(raw);
}

/**
 * Under the chosen transfer method at checkout, in the theme's colors (--as-*): how much to send and where (copy
 * the number, open the link), then the receipt and the sender (optional). Sent with the order.
 */
export function TransferBox({ method, total, draft, onDraft, error }: { method: TransferMethod; total: number | null; draft: ReceiptDraft; onDraft: (d: ReceiptDraft) => void; error?: string | null }) {
  const [copied, setCopied] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const copy = async () => {
    if (!method.account) return;
    try {
      await navigator.clipboard.writeText(method.account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the number is on screen to copy by hand.
    }
  };

  const pick = async (raw: File) => {
    setFileError(null);
    setPreparing(true);
    try {
      onDraft({ ...draft, file: await readyReceipt(raw) });
    } catch (e) {
      setFileError(e instanceof ImageRejected && e.reason === "size" ? t.tooBig : t.wrongType);
    } finally {
      setPreparing(false);
    }
  };

  const shown = fileError ?? error ?? null;
  return (
    <div id="pay-receipt" className="flex scroll-mt-28 flex-col gap-3 rounded-xl bg-(--as-soft) p-3">
      <p className="as-sm font-semibold">{total !== null ? t.sendAmount(formatMoney(total)) : method.name}</p>
      {method.account ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-(--as-bg) px-3 py-2">
          <span className="as-base font-mono font-bold" dir="ltr">
            {method.account}
          </span>
          <button type="button" onClick={() => void copy()} className="as-xs flex items-center gap-1 font-semibold text-(--as-primary)">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? t.copied : t.copy}
          </button>
        </div>
      ) : null}
      {method.link ? (
        <a href={method.link} target="_blank" rel="noopener noreferrer" className="as-btn as-sm h-11 gap-2">
          <ExternalLink className="size-4" aria-hidden />
          {method.kind === "link" ? t.payOnline : t.openLink}
        </a>
      ) : null}
      {method.instructions ? <p className="as-xs as-muted whitespace-pre-line">{method.instructions}</p> : null}

      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={t.receipt}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
      {draft.file ? (
        <span className="as-sm flex h-12 items-center gap-2 rounded-lg border bg-(--as-bg) px-3">
          <Paperclip className="size-4 shrink-0 opacity-60" aria-hidden />
          <span className="truncate" dir="ltr">
            {draft.file.name}
          </span>
          <button type="button" onClick={() => onDraft({ ...draft, file: null })} className="ms-auto rounded p-1 opacity-60 hover:opacity-100" aria-label={t.removeReceipt}>
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={preparing}
          className={`as-sm flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-(--as-bg) font-semibold disabled:opacity-60 ${shown ? "border-red-500/70" : "hover:border-(--as-primary)/60"}`}
        >
          {preparing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {t.receipt}
        </button>
      )}
      {shown ? (
        <p className="as-xs font-semibold text-red-600" role="alert">
          {shown}
        </p>
      ) : null}
      <label className="as-sm flex flex-col gap-1.5">
        <span className="font-semibold">{t.sender}</span>
        <input value={draft.sender} onChange={(e) => onDraft({ ...draft, sender: e.target.value })} maxLength={80} placeholder={t.senderPlaceholder} className="as-base h-11 rounded-lg border bg-(--as-bg) px-3" />
      </label>
    </div>
  );
}
