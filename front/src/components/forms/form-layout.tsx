"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * Form + side column: the form at a readable width, the summary / live preview sticky beside it
 * (under it on mobile). Product, offer, category forms all use this.
 */
export function FormLayout({ children, aside, className }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]", className)}>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      {aside ? <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">{aside}</aside> : null}
    </div>
  );
}

/** A titled part of a form; can collapse (long forms), shows a dot when it has errors. */
export function FormSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  hasError = false,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  hasError?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  const isOpen = !collapsible || open || hasError;
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      {collapsible ? (
        // The whole header toggles a collapsible section (one big target, keyboard friendly).
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={isOpen} aria-controls={id} className="flex w-full items-start justify-between gap-3 rounded-xl px-5 py-4 text-start transition-colors hover:bg-surface-2/50">
          <SectionTitle title={title} description={description} hasError={hasError} />
          <span className="mt-0.5 rounded-md p-1 text-ink-3">
            <ChevronDown className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
          </span>
        </button>
      ) : (
        <header className="px-5 py-4">
          <SectionTitle title={title} description={description} hasError={hasError} />
        </header>
      )}
      {isOpen ? (
        <div id={id} className="flex flex-col gap-4 border-t border-border px-5 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SectionTitle({ title, description, hasError }: { title: string; description?: string; hasError: boolean }) {
  return (
    <span className="block">
      <span className="flex items-center gap-2 font-display text-[15px] font-semibold">
        {title}
        {hasError ? <span className="size-2 rounded-full bg-danger" aria-label={ar.common.errorTitle} /> : null}
      </span>
      {description ? <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span> : null}
    </span>
  );
}

/** Sticky bar at the bottom while a form has unsaved changes. */
export function SaveBar({ visible, saving, onSave, onDiscard }: { visible: boolean; saving?: boolean; onSave: () => void; onDiscard?: () => void }) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-4 flex items-center gap-3 rounded-xl border border-border bg-ink px-4 py-3 text-white shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
      <span className="size-2 rounded-full bg-accent" aria-hidden />
      <span className="flex-1 text-sm">{ar.common.unsavedChanges}</span>
      {onDiscard ? (
        <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={onDiscard}>
          {ar.common.discard}
        </Button>
      ) : null}
      <Button size="sm" className="bg-white text-ink hover:bg-white/90" loading={saving} onClick={onSave}>
        {ar.common.save}
      </Button>
    </div>
  );
}

/** Warns before leaving the page with unsaved changes (closing the tab / reload). */
export function useUnsavedWarning(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
