"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { ar } from "@/messages/ar";
import { attachmentUrl, type Attachment, type Side } from "./api";

const t = ar.support.media;

/**
 * Full-screen viewer for a message's files: images fit the screen, a video plays only once opened
 * (nothing loads in the chat itself). Arrows / keys move between the message's files; Esc or the
 * backdrop closes. A video the browser can't play (e.g. some phone formats) offers the download.
 */
export function MediaViewer({ side, items, index, onIndex, onClose }: { side: Side; items: Attachment[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const item = index === null ? null : items[index];
  const [failed, setFailed] = React.useState<number | null>(null);
  const many = items.length > 1;

  function move(step: number) {
    if (index === null || !many) return;
    onIndex((index + step + items.length) % items.length);
  }

  return (
    <DialogPrimitive.Root open={item !== null && item !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/90 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] flex flex-col focus-visible:outline-none"
          onKeyDown={(e) => {
            // RTL: the left arrow goes forward.
            if (e.key === "ArrowLeft") move(1);
            if (e.key === "ArrowRight") move(-1);
          }}
        >
          {item ? (
            <>
              <div className="flex items-center gap-2 px-4 py-3 text-white">
                <DialogPrimitive.Title className="min-w-0 truncate text-sm font-semibold">
                  <bdi>{item.name}</bdi>
                </DialogPrimitive.Title>
                <span className="flex-1 text-xs text-white/60">{many && index !== null ? t.position(index + 1, items.length) : null}</span>
                <a href={attachmentUrl(side, item.id)} download={item.name} className="rounded-full p-2 hover:bg-white/10" aria-label={t.download} title={t.download}>
                  <Download className="size-5" aria-hidden />
                </a>
                <DialogPrimitive.Close className="rounded-full p-2 hover:bg-white/10" aria-label={t.close} title={t.close}>
                  <X className="size-5" aria-hidden />
                </DialogPrimitive.Close>
              </div>
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6"
                onClick={(e) => {
                  if (e.target === e.currentTarget) onClose();
                }}
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private files through the BFF
                  <img key={item.id} src={attachmentUrl(side, item.id)} alt={item.name} className="max-h-full max-w-full rounded-lg object-contain" />
                ) : failed === item.id ? (
                  <div className="flex flex-col items-center gap-4 text-center text-white">
                    <p className="max-w-xs text-sm">{t.cantPlay}</p>
                    <a href={attachmentUrl(side, item.id)} download={item.name} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                      <Download className="size-4" aria-hidden />
                      {t.download}
                    </a>
                  </div>
                ) : (
                  <video key={item.id} src={attachmentUrl(side, item.id)} controls autoPlay playsInline onError={() => setFailed(item.id)} className="max-h-full max-w-full rounded-lg bg-black" aria-label={item.name} />
                )}
                {many ? (
                  <>
                    <button type="button" onClick={() => move(-1)} className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label={t.prev}>
                      <ChevronRight className="size-6" aria-hidden />
                    </button>
                    <button type="button" onClick={() => move(1)} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label={t.next}>
                      <ChevronLeft className="size-6" aria-hidden />
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
