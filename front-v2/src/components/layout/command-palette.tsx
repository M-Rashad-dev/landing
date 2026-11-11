"use client";

import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DASHBOARD_FOOTER_NAV, DASHBOARD_NAV } from "@/config/navigation";
import { ar } from "@/messages/ar";

export type QuickResult = { id: string; group: string; label: string; hint?: string; href: string };

/**
 * Ctrl+K / ⌘K from anywhere: jump to a page now; orders by number, customers by phone and
 * products by name join through `extraResults` when those parts are built (server search).
 */
export function CommandPalette({ open, onOpenChange, extraResults = [] }: { open: boolean; onOpenChange: (open: boolean) => void; extraResults?: QuickResult[] }) {
  const router = useRouter();

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const pages = [...DASHBOARD_NAV.flatMap((g) => g.items), ...DASHBOARD_FOOTER_NAV];
  const groups = Array.from(new Set(extraResults.map((r) => r.group)));

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content dir="rtl" className="fixed start-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DialogPrimitive.Title className="sr-only">{ar.nav.quickSearchShort}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{ar.nav.quickSearch}</DialogPrimitive.Description>
          <Command label={ar.nav.quickSearchShort} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-ink-3" aria-hidden />
              <Command.Input autoFocus placeholder={ar.nav.quickSearch} className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">{ar.nav.quickSearchEmpty}</Command.Empty>
              <Command.Group heading={ar.nav.quickGroups.pages} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                {pages.map((item) => {
                  const Icon = item.icon;
                  const locked = item.status === "soon";
                  return (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      disabled={locked}
                      onSelect={() => go(item.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[selected=true]:bg-surface-2"
                    >
                      <Icon className="size-4 text-ink-3" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {locked ? <Lock className="size-3.5 text-ink-3" aria-hidden /> : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              {groups.map((group) => (
                <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                  {extraResults
                    .filter((r) => r.group === group)
                    .map((r) => (
                      <Command.Item key={r.id} value={`${r.label} ${r.hint ?? ""}`} onSelect={() => go(r.href)} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-2">
                        <span>{r.label}</span>
                        {r.hint ? (
                          <span className="tabular text-xs text-ink-3" dir="ltr">
                            {r.hint}
                          </span>
                        ) : null}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
