"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Images, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { UploadDropzone } from "@/components/shared/media/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format/number";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { deleteMedia, formatBytes, mediaKeys, updateMediaAlt, useMediaLibrary, useUploader } from "@/lib/media/hooks";
import type { MediaItem, MediaUsage } from "@/lib/types";
import { ar } from "@/messages/ar";

export function MediaLibrary() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const library = useMediaLibrary(debounced);
  const uploader = useUploader({ onUploaded: (items) => toast.success(ar.media.uploaded(items.length)) });
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [usages, setUsages] = useState<MediaUsage[] | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => library.data?.pages.flatMap((page) => page.data) ?? [], [library.data]);
  const total = library.data?.pages[0]?.meta.total ?? 0;

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteMedia(deleting.id);
      toast.success(ar.media.deleted);
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setUsages((error.body.usages as MediaUsage[] | undefined) ?? []);
        setDeleting(null);
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <UploadDropzone onFiles={(files) => uploader.add(files)} items={uploader.items.slice(0, 8)} compact={items.length > 0} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar.media.searchPlaceholder} className="ps-9" aria-label={ar.common.search} />
        </div>
        {total ? <span className="text-sm text-muted-foreground">{ar.common.total}: {formatNumber(total)}</span> : null}
      </div>

      {library.isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : library.isError ? (
        <ErrorState error={library.error} onRetry={() => library.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Images} title={debounced ? ar.common.noResults : ar.media.emptyTitle} description={debounced ? undefined : ar.media.emptyText} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <li key={item.id} className="group overflow-hidden rounded-xl border bg-card">
                <MediaThumb media={item} className="rounded-none" />
                <div className="flex items-center gap-1 p-2">
                  <p className="min-w-0 flex-1 truncate text-xs" dir="auto" title={item.name}>
                    {item.alt || item.name}
                  </p>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(item)} aria-label={ar.media.editAlt}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(item)} aria-label={ar.common.delete}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {library.hasNextPage ? (
            <Button variant="outline" className="self-center" loading={library.isFetchingNextPage} onClick={() => library.fetchNextPage()}>
              {ar.media.loadMore}
            </Button>
          ) : null}
        </>
      )}

      <AltDialog
        media={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={ar.media.deleteTitle}
        description={ar.media.deleteText}
        confirmLabel={ar.common.delete}
        destructive
        loading={busy}
        onConfirm={confirmDelete}
      />

      <Dialog open={usages !== null} onOpenChange={(open) => !open && setUsages(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{ar.media.inUseTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-3 text-sm text-muted-foreground">{ar.media.inUseText}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {usages?.map((usage) => (
                <li key={`${usage.type}-${usage.id}`} className="rounded-lg border px-3 py-2">
                  <span className="font-semibold">{usage.label}</span>: {usage.name}
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setUsages(null)}>{ar.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AltDialog({ media, onClose, onSaved }: { media: MediaItem | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={media !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">{media ? <AltForm key={media.id} media={media} onClose={onClose} onSaved={onSaved} /> : null}</DialogContent>
    </Dialog>
  );
}

function AltForm({ media, onClose, onSaved }: { media: MediaItem; onClose: () => void; onSaved: () => void }) {
  const [alt, setAlt] = useState(media.alt ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await updateMediaAlt(media.id, alt.trim() || null);
      toast.success(ar.media.altSaved);
      onSaved();
    } catch (err) {
      setError(isApiError(err) ? (err.errors.alt?.[0] ?? errorMessage(err)) : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{ar.media.editAlt}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="mx-auto w-40">
          <MediaThumb media={media} size="medium" />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <dt>{ar.media.dimensions}</dt>
          <dd dir="ltr" className="text-end">
            {media.width} × {media.height}
          </dd>
          <dt>{ar.media.size}</dt>
          <dd dir="ltr" className="text-end">
            {formatBytes(media.size)}
          </dd>
        </dl>
        <FormField label={ar.media.alt} htmlFor="media-alt" hint={ar.media.altHint} error={error}>
          <Input id="media-alt" value={alt} maxLength={255} onChange={(event) => setAlt(event.target.value)} aria-invalid={!!error} />
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {ar.common.cancel}
        </Button>
        <Button onClick={save} loading={saving}>
          {ar.common.save}
        </Button>
      </DialogFooter>
    </>
  );
}
