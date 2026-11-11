import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The one raised surface of the dashboard. Use it for a block that needs separating
 * (a table, a form section, a chart) — never a panel inside a panel.
 */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-border bg-surface", className)} {...props} />;
}

export function PanelHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function PanelFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return <footer className={cn("flex items-center justify-end gap-2 border-t border-border px-5 py-3", className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd dir="ltr" className={cn("inline-flex h-5 items-center rounded border border-border-strong bg-surface px-1.5 font-sans text-[11px] font-semibold text-ink-3", className)} {...props} />;
}

/** Initials or an image, round. */
export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand-strong", className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnails */}
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

/** Square product / media thumbnail with a neutral placeholder. */
export function Thumb({ src, alt = "", size = 40, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2", className)} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnails */}
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : <span className="size-1/3 rounded-sm bg-surface-3" aria-hidden />}
    </span>
  );
}
