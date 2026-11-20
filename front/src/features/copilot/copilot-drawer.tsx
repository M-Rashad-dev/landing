"use client";

import { Maximize2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { useCopilotStatus } from "./api";
import { CopilotChat } from "./copilot-chat";
import { useCopilot } from "./copilot-provider";

const t = ar.copilot;

/** The top-bar button «✨ المساعد» (hidden while the copilot is off). */
export function CopilotButton() {
  const { open, toggle } = useCopilot();
  const status = useCopilotStatus();
  const pathname = usePathname();
  if (status.data?.enabled !== true || pathname === "/dashboard/copilot") return null;
  return (
    <Tooltip content={t.buttonHint} side="bottom">
      <Button type="button" variant={open ? "secondary" : "ghost"} size="sm" onClick={toggle} aria-pressed={open} aria-label={t.buttonHint}>
        <Sparkles className="text-violet-600" />
        <span className="hidden sm:inline">{t.button}</span>
      </Button>
    </Tooltip>
  );
}

/**
 * The copilot beside the page: docked at the end side on desktop (the page stays usable next to it), full screen on
 * phones. Esc closes it.
 */
export function CopilotDrawer({ userId }: { userId: number }) {
  const { open, setOpen } = useCopilot();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open || pathname === "/dashboard/copilot") return null;

  return (
    <aside
      aria-label={t.name}
      className="fixed inset-0 z-50 flex flex-col bg-surface lg:sticky lg:top-0 lg:z-20 lg:h-dvh lg:w-[400px] lg:shrink-0 lg:border-s lg:border-border print:hidden"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 text-white">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink">{t.name}</h2>
            <p className="truncate text-[11px] text-ink-3">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t.openFull}>
            <Link href="/dashboard/copilot" onClick={() => setOpen(false)}>
              <Maximize2 />
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t.close} onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
      </div>
      <CopilotChat userId={userId} />
    </aside>
  );
}
