"use client";

import { ArrowRight, CheckCircle2, ChevronLeft, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";
import * as React from "react";
import { toast } from "@/components/ui/feedback";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * What every Builder shares (the store's and the landing pages'): the editing state with undo /
 * redo and autosave, and the pieces of the screen (rail, panel, inspector, device frame, status).
 */

const t = ar.design.builder;
const HISTORY = 60;

export type SaveState = "saved" | "dirty" | "saving" | "invalid" | "conflict";
export type Device = "desktop" | "tablet" | "mobile";

/**
 * A draft edited on screen and saved by itself (a short pause after the last edit, one request at
 * a time, the version checked by the server). `change(next, typing)`: quick edits in a row while
 * typing make one undo step; moves, adds and deletes are steps of their own.
 */
export function useDraftEditor<T, R extends { version: number }>({
  initial,
  version: initialVersion,
  save,
  onSaved,
  onEscape,
}: {
  initial: T;
  version: number;
  save: (draft: T, version: number) => Promise<R>;
  onSaved?: (result: R) => void;
  onEscape?: () => void;
}) {
  const [draft, setDraft] = React.useState<T>(initial);
  const [status, setStatus] = React.useState<SaveState>("saved");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [history, setHistory] = React.useState<{ past: T[]; future: T[] }>({ past: [], future: [] });
  const version = React.useRef(initialVersion);
  const pending = React.useRef<T | null>(null);
  const saving = React.useRef<Promise<boolean> | null>(null);
  const lastStep = React.useRef(0);
  const callbacks = React.useRef({ save, onSaved, onEscape });
  // The latest callbacks for the async save and the key handler (refreshed after each render).
  React.useEffect(() => {
    callbacks.current = { save, onSaved, onEscape };
  });

  const flush = React.useCallback(async (): Promise<boolean> => {
    if (saving.current) await saving.current;
    const next = pending.current;
    if (!next) return true;
    pending.current = null;
    setStatus("saving");
    const run = (async () => {
      try {
        const res = await callbacks.current.save(next, version.current);
        version.current = res.version;
        setErrors({});
        callbacks.current.onSaved?.(res);
        setStatus(pending.current ? "dirty" : "saved");
        return true;
      } catch (error) {
        if (isApiError(error) && error.status === 409) setStatus("conflict");
        else if (isApiError(error) && error.isValidation) {
          setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? ""])));
          setStatus("invalid");
        } else {
          toast.error(errorMessage(error));
          pending.current ??= next;
          setStatus("dirty");
        }
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = run;
    return run;
  }, []);

  React.useEffect(() => {
    if (status !== "dirty") return;
    const timer = window.setTimeout(() => void flush(), 700);
    return () => window.clearTimeout(timer);
  }, [draft, status, flush]);

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const apply = (next: T) => {
    setDraft(next);
    pending.current = next;
    setStatus((s) => (s === "conflict" ? s : "dirty"));
  };

  const change = (next: T, typing = false) => {
    const now = Date.now();
    if (!typing || now - lastStep.current > 800) setHistory((h) => ({ past: [...h.past, draft].slice(-HISTORY), future: [] }));
    else setHistory((h) => (h.future.length ? { ...h, future: [] } : h));
    lastStep.current = typing ? now : 0;
    apply(next);
  };

  const undo = () => {
    const previous = history.past.at(-1);
    if (previous === undefined) return;
    setHistory({ past: history.past.slice(0, -1), future: [draft, ...history.future] });
    lastStep.current = 0;
    apply(previous);
  };
  const redo = () => {
    const next = history.future[0];
    if (next === undefined) return;
    setHistory({ past: [...history.past, draft], future: history.future.slice(1) });
    lastStep.current = 0;
    apply(next);
  };

  // Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) outside text fields; Esc closes the settings.
  const keys = React.useRef({ undo, redo });
  React.useEffect(() => {
    keys.current = { undo, redo };
  });
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element ? e.target.closest("input, textarea, select, [contenteditable=true]") : null;
      if (e.key === "Escape" && !document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) callbacks.current.onEscape?.();
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        keys.current.undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        keys.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    draft,
    change,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    status,
    setStatus,
    errors,
    setErrors,
    flush,
    /** After an action that changes the version outside the autosave (publishing). */
    setVersion: (next: number) => {
      version.current = next;
    },
  };
}

/* ---------- Pieces ---------- */

export function RailButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition", active ? "bg-brand-soft text-brand-strong" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

export function PanelTitle({ title, hint, badge }: { title: string; hint: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {badge ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">{badge}</span> : null}
      </div>
      <p className="text-xs leading-relaxed text-ink-3">{hint}</p>
    </div>
  );
}

export function PanelIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2" aria-hidden>
      <Icon className="size-3.5" />
    </span>
  );
}

/** Header and footer: always there, not moved, opened like a section. */
export function PinnedRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-start transition hover:border-border-strong hover:bg-surface-2">
      <PanelIcon icon={Icon} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-ink-3">{t.pinned}</span>
      </span>
      <ChevronLeft className="size-4 text-ink-3" aria-hidden />
    </button>
  );
}

/** A row that opens a group of settings in the panel. */
export function GroupRow({ icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:border-border-strong hover:bg-surface-2/60">
      <PanelIcon icon={icon} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="truncate text-xs text-ink-3">{hint}</span>
      </span>
      <ChevronLeft className="size-4 text-ink-3" aria-hidden />
    </button>
  );
}

export function Inspector({ title, icon, back, onBack, actions, children }: { title: string; icon: React.ReactNode; back: string; onBack: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-3 pb-3 pt-2">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold text-ink-3 hover:text-ink">
          <ArrowRight className="size-3.5" />
          {t.backTo(back)}
        </button>
        <div className="flex items-center gap-2 px-1">
          {icon}
          <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold">{title}</h2>
          {actions}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

export function ToolButton({ icon: Icon, label, onClick, disabled = false, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={cn("flex size-7 items-center justify-center rounded-md transition hover:bg-white/15 disabled:opacity-30", danger && "hover:bg-red-500/80")}>
      <Icon className="size-3.5" />
    </button>
  );
}

export function CanvasChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg" dir="rtl">
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

/** The preview inside a browser window, a tablet or a phone. */
export function DeviceFrame({ device, host, children }: { device: Device; host: string; children: React.ReactNode }) {
  if (device === "desktop") {
    return (
      <div className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl">
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3" dir="ltr">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="mx-auto w-full max-w-sm truncate rounded-md bg-surface px-3 py-0.5 text-center text-[11px] text-ink-3">{host}</span>
          <span className="w-12" aria-hidden />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }
  const phone = device === "mobile";
  return (
    <div className={cn("mx-auto flex h-full flex-col overflow-hidden bg-white shadow-2xl ring-ink transition-[width] duration-300", phone ? "w-[390px] rounded-[2.4rem] ring-[10px]" : "w-[820px] max-w-full rounded-[1.6rem] ring-[12px]")}>
      {phone ? <div className="mx-auto mt-1.5 h-5 w-28 shrink-0 rounded-full bg-ink" aria-hidden /> : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function SaveStatus({ status }: { status: SaveState }) {
  const base = "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  if (status === "saving" || status === "dirty")
    return (
      <span className={cn(base, "bg-surface-2 text-ink-3")}>
        <Loader2 className="size-3.5 animate-spin" />
        {status === "saving" ? t.saving : t.unsaved}
      </span>
    );
  if (status === "invalid")
    return (
      <span className={cn(base, "bg-danger-soft text-danger")}>
        <TriangleAlert className="size-3.5" />
        {t.invalid}
      </span>
    );
  if (status === "conflict") return null;
  return (
    <span className={cn(base, "bg-success-soft text-success")}>
      <CheckCircle2 className="size-3.5" />
      {t.saved}
    </span>
  );
}
