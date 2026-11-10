"use client";

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTheme } from "@/themes/registry";
import { SCHEMAS } from "@/themes/shared/schemas";
import { typesForKind, type ComponentType } from "@/themes/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useBuilder } from "./context";
import { canAdd, MAX_SECTIONS } from "./store";

/** The component cards the page kind allows; singletons already on the page are disabled. */
export function LibraryDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded?: (id: string) => void }) {
  const sections = useBuilder((s) => s.content.sections);
  const themeKey = useBuilder((s) => s.themeKey);
  const addSection = useBuilder((s) => s.addSection);
  const kind = useBuilder((s) => s.page?.kind ?? "landing");
  const theme = getTheme(themeKey);
  const full = sections.length >= MAX_SECTIONS;

  function add(type: ComponentType) {
    const id = addSection(type);
    if (id) {
      onAdded?.(id);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{ar.builder.library}</DialogTitle>
          <DialogDescription>{full ? ar.builder.maxSections(MAX_SECTIONS) : ar.builder.libraryHint}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {typesForKind(kind).map((type) => {
              const schema = SCHEMAS[type];
              const allowed = canAdd(sections, type);
              const Thumb = theme.components[type].Thumbnail;
              const exists = sections.some((s) => s.type === type);
              return (
                <li key={type}>
                  <button
                    type="button"
                    disabled={!allowed}
                    onClick={() => add(type)}
                    className={cn("flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-start transition-colors", allowed ? "hover:border-primary hover:bg-secondary/50" : "cursor-not-allowed opacity-50")}
                  >
                    <div className="aspect-[5/3] overflow-hidden rounded-lg bg-muted p-2 text-primary">
                      <Thumb />
                    </div>
                    <span className="font-bold">{schema.label}</span>
                    <span className="text-xs text-muted-foreground">{schema.description}</span>
                    {!allowed ? <span className="text-xs font-semibold text-warning">{exists && schema.limits.max === 1 ? ar.builder.alreadyAdded : ar.builder.limitReached}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
