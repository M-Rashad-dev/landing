"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImagePlus, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { MediaItem } from "./api";
import { MediaPicker } from "./media-picker";

const t = ar.media;

/** Ordered images (product gallery): drag to sort, the first is the main image. */
export function ImageGallery({ value, onChange, max = 10 }: { value: MediaItem[]; onChange: (items: MediaItem[]) => void; max?: number }) {
  const [picking, setPicking] = React.useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(value, value.findIndex((m) => m.id === active.id), value.findIndex((m) => m.id === over.id)));
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.map((m) => m.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {value.map((item, i) => (
              <Tile key={item.id} item={item} main={i === 0} onRemove={() => onChange(value.filter((m) => m.id !== item.id))} />
            ))}
            {value.length < max ? (
              <li>
                <button type="button" onClick={() => setPicking(true)} className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-xs font-semibold text-ink-3 transition-colors hover:border-brand hover:bg-brand-soft/40 hover:text-brand-strong">
                  <ImagePlus className="size-5" aria-hidden />
                  {t.add}
                </button>
              </li>
            ) : null}
          </ul>
        </SortableContext>
      </DndContext>
      {value.length > 1 ? <p className="text-xs text-ink-3">{t.dragToSort}</p> : null}
      <MediaPicker open={picking} onOpenChange={setPicking} max={max} already={value.length} onPick={(items) => onChange([...value, ...items.filter((n) => !value.some((m) => m.id === n.id))].slice(0, max))} />
    </div>
  );
}

function Tile({ item, main, onRemove }: { item: MediaItem; main: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn("group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2", isDragging && "z-10 shadow-lg")}>
      <button type="button" className="block size-full cursor-grab active:cursor-grabbing" aria-label={t.handle} {...attributes} {...listeners}>
        {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnail */}
        <img src={item.urls.thumb} alt="" className="size-full object-cover" draggable={false} />
      </button>
      {main ? (
        <Badge tone="brand" size="sm" className="pointer-events-none absolute start-1.5 top-1.5">
          {t.mainImage}
        </Badge>
      ) : null}
      <button type="button" onClick={onRemove} className="absolute end-1.5 top-1.5 rounded-md bg-surface/90 p-1 text-ink-2 shadow-sm transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" aria-label={t.remove}>
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** One image (category image, share image): preview, change, remove. */
export function ImageField({ value, onChange }: { value: { id: number; url: string } | null; onChange: (item: MediaItem | null) => void }) {
  const [picking, setPicking] = React.useState(false);
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setPicking(true)} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-2 text-ink-3 transition-colors hover:border-brand hover:text-brand-strong" aria-label={value ? t.change : t.add}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- media thumbnail
          <img src={value.url} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5" aria-hidden />
        )}
      </button>
      <div className="flex flex-col items-start gap-1">
        <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
          {value ? t.change : t.add}
        </Button>
        {value ? (
          <Button variant="danger-ghost" size="sm" onClick={() => onChange(null)}>
            {t.remove}
          </Button>
        ) : null}
      </div>
      <MediaPicker open={picking} onOpenChange={setPicking} max={1} onPick={(items) => onChange(items[0] ?? null)} />
    </div>
  );
}
