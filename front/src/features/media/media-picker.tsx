"use client";

import { Check, ImageOff, Search, Upload } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { IMAGE_ACCEPT, ImageRejected } from "@/lib/media/compress";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { uploadImages, useMediaLibrary, useRefreshMedia, type MediaItem } from "./api";

const t = ar.media;

/**
 * Pick images from the store's library or upload new ones (compressed first). `max` = how many
 * can be picked (1 = a single image). New uploads are selected right away.
 */
export function MediaPicker({ open, onOpenChange, max = 1, already = 0, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; max?: number; already?: number; onPick: (items: MediaItem[]) => void }) {
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [chosen, setChosen] = React.useState<MediaItem[]>([]);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = React.useState(false);
  const inputId = React.useId();
  const library = useMediaLibrary(search, open);
  const refresh = useRefreshMedia();
  const room = Math.max(0, max - already);

  React.useEffect(() => {
    const id = window.setTimeout(() => setSearch(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  function toggle(item: MediaItem) {
    setChosen((list) => {
      if (list.some((m) => m.id === item.id)) return list.filter((m) => m.id !== item.id);
      if (room === 1) return [item];
      if (list.length >= room) {
        toast.message(t.maxReached(max));
        return list;
      }
      return [...list, item];
    });
  }

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setProgress({ done: 0, total: files.length });
    try {
      const items = await uploadImages(files, {
        onPrepared: (done) => setProgress({ done, total: files.length }),
        onRejected: (error) => toast.error(error instanceof ImageRejected ? (error.reason === "type" ? t.rejectedType(error.fileName) : t.rejectedSize(error.fileName)) : errorMessage(error)),
      });
      if (items.length) {
        toast.success(t.uploaded(items.length));
        setChosen((list) => (room === 1 ? items.slice(0, 1) : [...list, ...items].slice(0, room)));
        await refresh();
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  function close(next: boolean) {
    if (!next) setChosen([]);
    onOpenChange(next);
  }

  const items = library.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="xl">
        <DialogHeader title={max > 1 ? t.pickTitle : t.pickTitleOne} description={t.pickDescription} />
        <DialogBody
          className="flex flex-col gap-3"
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <InputGroup start={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} className="flex-1" />
            <Button variant="outline" asChild disabled={progress !== null}>
              <label htmlFor={inputId}>
                <Upload />
                {t.upload}
              </label>
            </Button>
            <input
              id={inputId}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple={room !== 1}
              className="sr-only"
              onChange={(e) => {
                void upload(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          {progress ? <Alert tone="info">{t.uploading(progress.done, progress.total)}</Alert> : null}

          <div className={cn("min-h-64 rounded-xl border border-dashed p-2 transition-colors", over ? "border-brand bg-brand-soft/40" : "border-transparent")}>
            {library.isPending ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : library.isError ? (
              <ErrorState onRetry={() => void library.refetch()} message={errorMessage(library.error)} />
            ) : items.length === 0 ? (
              <EmptyState icon={ImageOff} title={t.empty} description={t.emptyText} />
            ) : (
              <>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {items.map((item) => {
                    const index = chosen.findIndex((m) => m.id === item.id);
                    const on = index !== -1;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          aria-pressed={on}
                          aria-label={item.alt || item.name}
                          className={cn("relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-surface-2 transition-[border-color,box-shadow]", on ? "border-primary ring-3 ring-primary/20" : "border-transparent hover:border-border-strong")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnail */}
                          <img src={item.urls.thumb} alt="" loading="lazy" className="size-full object-cover" />
                          {on ? (
                            <span className="absolute end-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-ink shadow-sm">
                              {room > 1 ? index + 1 : <Check className="size-3.5" strokeWidth={3} />}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {library.hasNextPage ? (
                  <div className="mt-3 flex justify-center">
                    <Button variant="ghost" size="sm" loading={library.isFetchingNextPage} onClick={() => void library.fetchNextPage()}>
                      {t.loadMore}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {ar.common.cancel}
          </Button>
          <Button
            disabled={chosen.length === 0}
            onClick={() => {
              onPick(chosen);
              close(false);
            }}
          >
            {t.choose(chosen.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
