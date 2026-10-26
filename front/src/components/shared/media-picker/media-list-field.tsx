"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMediaByIds } from "@/lib/media/hooks";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { MediaPicker } from "./media-picker";

/** Multiple images stored as an ordered id list; drag (or keyboard) to reorder. */
export function MediaListField({
  value,
  onChange,
  max = 10,
  showMainBadge = false,
  invalid,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  max?: number;
  showMainBadge?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { byId } = useMediaByIds(value);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = value.indexOf(Number(active.id));
    const to = value.indexOf(Number(over.id));
    if (from >= 0 && to >= 0) onChange(arrayMove(value, from, to));
  }

  function move(id: number, delta: -1 | 1) {
    const from = value.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= value.length) return;
    onChange(arrayMove(value, from, to));
  }

  return (
    <div className={cn("flex flex-col gap-3", invalid && "rounded-lg ring-1 ring-destructive")}>
      {value.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {value.map((id, index) => (
                <SortableThumb
                  key={id}
                  id={id}
                  index={index}
                  count={value.length}
                  media={byId.get(id)}
                  main={showMainBadge && index === 0}
                  onRemove={() => onChange(value.filter((item) => item !== id))}
                  onMove={(delta) => move(id, delta)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={value.length >= max} onClick={() => setOpen(true)}>
          <ImagePlus />
          {ar.media.addImages}
        </Button>
        <span className="text-xs text-muted-foreground">
          {value.length}/{max}
          {value.length > 1 ? ` · ${ar.media.dragToReorder}` : ""}
        </span>
      </div>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        mode="multiple"
        max={max}
        selected={value}
        onConfirm={(items) => onChange([...value, ...items.map((item) => item.id).filter((id) => !value.includes(id))].slice(0, max))}
      />
    </div>
  );
}

function SortableThumb({
  id,
  index,
  count,
  media,
  main,
  onRemove,
  onMove,
}: {
  id: number;
  index: number;
  count: number;
  media: ReturnType<typeof useMediaByIds>["items"][number] | undefined;
  main: boolean;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative overflow-hidden rounded-lg border bg-card", isDragging && "z-10 shadow-lg")}
    >
      <MediaThumb media={media} className="rounded-none" />
      {main ? <Badge className="absolute start-1.5 top-1.5 bg-primary text-primary-foreground">{ar.media.main}</Badge> : null}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 p-1">
        <button
          type="button"
          className="flex size-7 cursor-grab items-center justify-center rounded text-white focus-visible:outline-2 focus-visible:outline-white active:cursor-grabbing"
          aria-label={`${ar.media.dragToReorder} (${index + 1}/${count})`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex gap-1">
          <button type="button" className="sr-only focus:not-sr-only focus:rounded focus:px-1 focus:text-xs focus:text-white" onClick={() => onMove(-1)} disabled={index === 0}>
            {ar.media.moveEarlier}
          </button>
          <button type="button" className="sr-only focus:not-sr-only focus:rounded focus:px-1 focus:text-xs focus:text-white" onClick={() => onMove(1)} disabled={index === count - 1}>
            {ar.media.moveLater}
          </button>
          <button type="button" onClick={onRemove} className="flex size-7 items-center justify-center rounded text-white hover:bg-white/20" aria-label={ar.media.remove}>
            <X className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
