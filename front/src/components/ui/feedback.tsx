"use client";

import { AlertTriangle, CheckCircle2, Info, Lock, OctagonAlert, RefreshCw, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { Button } from "./button";

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

/* ---------- Alert (inline message that stays) ---------- */

const ALERT = {
  info: { icon: Info, className: "border-info/25 bg-info-soft text-info" },
  success: { icon: CheckCircle2, className: "border-success/25 bg-success-soft text-success" },
  warning: { icon: AlertTriangle, className: "border-warning/25 bg-warning-soft text-warning" },
  danger: { icon: OctagonAlert, className: "border-danger/25 bg-danger-soft text-danger" },
  attention: { icon: AlertTriangle, className: "border-accent/50 bg-accent-soft text-accent-ink" },
} satisfies Record<string, { icon: LucideIcon; className: string }>;

export function Alert({ tone = "info", title, children, action, className }: { tone?: keyof typeof ALERT; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", toneClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------- Empty / error / locked ---------- */

/** Nothing here yet: says what this place is for and gives one next step. */
export function EmptyState({ title, description, action, icon: Icon, className, compact = false }: { title: string; description?: string; action?: React.ReactNode; icon?: LucideIcon; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon ? <Icon className="mb-3 size-6 text-ink-3" aria-hidden /> : null}
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-ink-3">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ onRetry, message, className }: { onRetry?: () => void; message?: string; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <OctagonAlert className="mb-3 size-6 text-danger" aria-hidden />
      <p className="font-display text-[15px] font-semibold">{ar.common.errorTitle}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-3">{message ?? ar.common.errorText}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw />
          {ar.common.retry}
        </Button>
      ) : null}
    </div>
  );
}

/** A feature the store's plan does not include. */
export function LockedNotice({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-2/60 p-4 sm:flex-row sm:items-center">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-ink-2">
        <Lock className="size-4" aria-hidden />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ---------- Toasts ---------- */

export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="bottom-left"
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-surface !text-ink !shadow-md !font-sans",
          description: "!text-ink-3",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          info: "[&_[data-icon]]:!text-info",
        },
      }}
    />
  );
}

export const toast = sonnerToast;
