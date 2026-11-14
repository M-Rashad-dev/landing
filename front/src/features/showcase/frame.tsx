import * as React from "react";
import { cn } from "@/lib/utils";

/** One section of the components page: anchor, title, what it is for, then its specimens. */
export function ShowSection({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 max-w-3xl text-[13px] text-ink-3">{description}</p>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A labelled row of examples inside a section. */
export function Specimen({ label, children, className, stack = false }: { label: string; children: React.ReactNode; className?: string; stack?: boolean }) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[9rem_1fr] md:gap-6 md:p-5">
      <p className="text-xs font-semibold text-ink-3 md:pt-2">{label}</p>
      <div className={cn(stack ? "flex flex-col gap-4" : "flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}

/** A labelled example card for wide components (cards, invoices) shown side by side. */
export function Tile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-surface p-4", className)}>
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      {children}
    </div>
  );
}
