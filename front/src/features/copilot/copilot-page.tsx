"use client";

import { History, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { CopilotChat } from "./copilot-chat";

const t = ar.copilot;

/** /dashboard/copilot: the same chat as the drawer, full width. */
export function CopilotPage() {
  const { user } = useSession();
  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 text-white">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-ink">{t.name}</h1>
          <p className="text-xs text-ink-3">{t.subtitle}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/copilot/history">
            <History />
            {t.history.link}
          </Link>
        </Button>
      </div>
      <CopilotChat userId={user.id} />
    </div>
  );
}
