"use client";

import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaByIds } from "@/lib/media/hooks";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { MediaPicker } from "./media-picker";

/** Single image chooser storing a media id. */
export function MediaField({
  id,
  value,
  onChange,
  purpose = "general",
  className,
  invalid,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (id: number | null, item: MediaItem | null) => void;
  purpose?: "general" | "favicon";
  className?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { items, isLoading } = useMediaByIds([value]);
  const media = items[0] ?? null;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("size-20 shrink-0 overflow-hidden rounded-lg border bg-muted", invalid && "border-destructive")}>
        {value && isLoading ? <Skeleton className="size-full" /> : <MediaThumb media={media} className="rounded-none" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button id={id} type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ImagePlus />
          {value ? ar.media.change : ar.media.selectImage}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null, null)}>
            <X />
            {ar.media.remove}
          </Button>
        ) : null}
      </div>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        purpose={purpose}
        onConfirm={([item]) => {
          if (item) onChange(item.id, item);
        }}
      />
    </div>
  );
}
