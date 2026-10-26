"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState } from "@/components/dashboard/error-state";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { UploadDropzone } from "@/components/shared/media/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { useMediaLibrary, useUploader } from "@/lib/media/hooks";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export type MediaPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "single" | "multiple";
  /** Max total selection in multiple mode. */
  max?: number;
  /** Already chosen ids (count toward max, shown as selected). */
  selected?: number[];
  purpose?: "general" | "favicon";
  onConfirm: (items: MediaItem[]) => void;
};

export function MediaPicker(props: MediaPickerProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Content unmounts when closed, so the picker state starts fresh on every open. */}
      <DialogContent size="xl" className="h-[92dvh]">
        <PickerBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onOpenChange, mode = "single", max = 1, selected = [], purpose = "general", onConfirm }: MediaPickerProps) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Map<number, MediaItem>>(new Map());
  const debounced = useDebounced(search, 300);
  const library = useMediaLibrary(debounced);
  const limit = mode === "single" ? 1 : Math.max(0, max - selected.filter((id) => !picked.has(id)).length);

  const uploader = useUploader({
    purpose,
    onUploaded: (items) => {
      setPicked((current) => {
        const next = mode === "single" ? new Map<number, MediaItem>() : new Map(current);
        for (const item of mode === "single" ? items.slice(0, 1) : items) {
          if (mode === "single" || next.size < limit) next.set(item.id, item);
        }
        return next;
      });
      setTab("library");
    },
  });

  const items = useMemo(() => library.data?.pages.flatMap((page) => page.data) ?? [], [library.data]);

  function toggle(item: MediaItem) {
    setPicked((current) => {
      if (mode === "single") return new Map([[item.id, item]]);
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size < limit) next.set(item.id, item);
      return next;
    });
  }

  function confirm() {
    onConfirm(Array.from(picked.values()));
    onOpenChange(false);
  }

  const reachedMax = mode === "multiple" && picked.size >= limit;

  return (
    <>
        <DialogHeader>
          <DialogTitle>{mode === "single" ? ar.media.pickerTitle : ar.media.pickerTitleMultiple}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col">
          <Tabs value={tab} onValueChange={(value) => setTab(value as "library" | "upload")} className="flex flex-1 flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="library">{ar.media.library}</TabsTrigger>
              <TabsTrigger value="upload">{ar.media.uploadNew}</TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="flex flex-1 flex-col gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar.media.searchPlaceholder} className="ps-9" aria-label={ar.common.search} />
              </div>
              {mode === "multiple" ? <p className="text-xs text-muted-foreground">{ar.media.maxReached(max)}</p> : null}

              {library.isPending ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} className="aspect-square" />
                  ))}
                </div>
              ) : library.isError ? (
                <ErrorState error={library.error} onRetry={() => library.refetch()} />
              ) : items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="font-semibold">{ar.media.emptyTitle}</p>
                  <Button variant="outline" onClick={() => setTab("upload")}>
                    {ar.media.uploadNew}
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6" role="listbox" aria-multiselectable={mode === "multiple"}>
                    {items.map((item) => {
                      const isPicked = picked.has(item.id);
                      const alreadyUsed = selected.includes(item.id) && !isPicked;
                      const disabled = alreadyUsed || (!isPicked && reachedMax);
                      return (
                        <li key={item.id} role="option" aria-selected={isPicked}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggle(item)}
                            onDoubleClick={() => {
                              if (mode === "single") {
                                onConfirm([item]);
                                onOpenChange(false);
                              }
                            }}
                            className={cn(
                              "relative block w-full overflow-hidden rounded-lg ring-offset-2 transition focus-visible:outline-2 focus-visible:outline-ring",
                              isPicked && "ring-2 ring-primary",
                              disabled && "cursor-not-allowed opacity-40",
                            )}
                            title={item.name}
                          >
                            <MediaThumb media={item} />
                            {isPicked ? (
                              <span className="absolute end-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-4" aria-hidden />
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {library.hasNextPage ? (
                    <Button variant="outline" className="self-center" loading={library.isFetchingNextPage} onClick={() => library.fetchNextPage()}>
                      {ar.media.loadMore}
                    </Button>
                  ) : null}
                </>
              )}
            </TabsContent>

            <TabsContent value="upload">
              <UploadDropzone onFiles={(files) => uploader.add(files)} items={uploader.items} multiple={mode === "multiple"} />
            </TabsContent>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ar.common.cancel}
          </Button>
          <Button onClick={confirm} disabled={picked.size === 0}>
            {mode === "multiple" ? ar.media.chooseCount(picked.size) : ar.media.choose}
          </Button>
        </DialogFooter>
    </>
  );
}
