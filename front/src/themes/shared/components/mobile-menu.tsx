"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * Light drawer/overlay menu for public headers (no dialog library).
 * Esc and link clicks close it; focus returns to the toggle.
 */
export function MobileMenu({ children, className, panelClassName, buttonClassName, overlay = false }: { children: ReactNode; className?: string; panelClassName?: string; buttonClassName?: string; overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = toggle.current;
    panel.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  return (
    <div className={className}>
      <button ref={toggle} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label={ar.site.menu} className={cn("flex size-10 items-center justify-center", buttonClassName)}>
        <Menu className="size-6" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={ar.site.menu}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            className={cn(overlay ? "absolute inset-0 flex flex-col p-6" : "absolute inset-y-0 start-0 flex w-4/5 max-w-xs flex-col p-6 shadow-xl", "t-bg", panelClassName)}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <button type="button" onClick={() => setOpen(false)} aria-label={ar.site.closeMenu} className="mb-6 flex size-10 items-center justify-center self-end">
              <X className="size-6" aria-hidden />
            </button>
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
