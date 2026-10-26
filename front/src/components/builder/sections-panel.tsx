"use client";

import { Copy, Eye, EyeOff, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import { IconView } from "@/themes/shared/icon-view";
import { SCHEMAS } from "@/themes/shared/schemas";
import type { Section } from "@/themes/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useBuilder } from "./context";
import { LibraryDialog } from "./library-dialog";
import { canAdd } from "./store";

const t = ar.builder;

export function SectionsPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const sections = useBuilder((s) => s.content.sections);
  const selectedId = useBuilder((s) => s.selectedId);
  const moveSection = useBuilder((s) => s.moveSection);
  const toggleVisible = useBuilder((s) => s.toggleVisible);
  const duplicateSection = useBuilder((s) => s.duplicateSection);
  const removeSection = useBuilder((s) => s.removeSection);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [removing, setRemoving] = useState<Section | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <SortableList
          items={sections}
          getId={(section) => section.id}
          onMove={moveSection}
          renderItem={(section, _index, handle) => {
            const schema = SCHEMAS[section.type];
            const pinned = Boolean(schema.limits.pinned);
            const selected = section.id === selectedId;
            return (
              <div className={cn("flex items-center gap-1 rounded-lg border bg-card p-1.5 transition-colors", selected && "border-primary bg-secondary", !section.visible && "opacity-60")}>
                {pinned ? (
                  <span className="flex size-8 items-center justify-center text-muted-foreground" title={schema.label}>
                    <Lock className="size-3.5" aria-hidden />
                  </span>
                ) : (
                  <DragHandle handle={handle} />
                )}
                <button type="button" onClick={() => onSelect(section.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-start text-sm font-medium" aria-current={selected ? "true" : undefined}>
                  <IconView name={schema.icon} className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{schema.label}</span>
                  {!section.visible ? <span className="text-xs text-muted-foreground">({t.hidden})</span> : null}
                </button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleVisible(section.id)} aria-label={section.visible ? t.hide : t.show}>
                  {section.visible ? <Eye /> : <EyeOff />}
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={!canAdd(sections, section.type)} onClick={() => duplicateSection(section.id)} aria-label={t.duplicate}>
                  <Copy />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setRemoving(section)} aria-label={t.remove}>
                  <Trash2 />
                </Button>
              </div>
            );
          }}
        />
      </div>
      <div className="border-t p-3">
        <Button type="button" className="w-full" onClick={() => setLibraryOpen(true)}>
          <Plus />
          {t.addSection}
        </Button>
      </div>
      <LibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} onAdded={onSelect} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t.removeTitle}
        description={t.removeText}
        confirmLabel={ar.common.delete}
        destructive
        onConfirm={() => {
          if (removing) removeSection(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}
