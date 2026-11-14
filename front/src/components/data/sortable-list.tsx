"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * Drag to reorder (mouse, touch and keyboard: focus the handle, Space, arrows, Space).
 * Categories, menus, product images and options use it. `depth` indents tree rows.
 */
export function SortableList<T>({ items, getId, onReorder, render, depthOf }: { items: T[]; getId: (item: T) => string; onReorder: (items: T[]) => void; render: (item: T) => React.ReactNode; depthOf?: (item: T) => number }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => getId(i) === active.id);
    const to = items.findIndex((i) => getId(i) === over.id);
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)} depth={depthOf?.(item) ?? 0}>
              {render(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, depth, children }: { id: string; depth: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, paddingInlineStart: `${0.5 + depth * 1.5}rem` }}
      className={cn("flex items-center gap-2 bg-surface py-2.5 pe-3", isDragging && "relative z-10 shadow-md")}
    >
      <button type="button" className="cursor-grab rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing" aria-label={ar.showcase.sortable.handle} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
