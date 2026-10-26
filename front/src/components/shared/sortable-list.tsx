"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export type DragHandleProps = { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners };

/**
 * Vertical sortable list (mouse, touch and keyboard: focus the handle, Space, arrows, Space).
 */
export function SortableList<T>({
  items,
  getId,
  onMove,
  renderItem,
  className,
}: {
  items: T[];
  getId: (item: T) => string;
  onMove: (from: number, to: number) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map(getId);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={cn("flex flex-col gap-2", className)}>
          {items.map((item, index) => (
            <SortableRow key={ids[index]} id={ids[index]}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: DragHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn("relative", isDragging && "z-10 opacity-90 shadow-lg")}>
      {children({ attributes, listeners })}
    </li>
  );
}

export function DragHandle({ handle, label = ar.media.dragToReorder, className }: { handle: DragHandleProps; label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={cn("flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing", className)}
      aria-label={label}
      {...handle.attributes}
      {...handle.listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
