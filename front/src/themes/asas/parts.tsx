"use client";

import { ChevronLeft, Minus, Plus, Star } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink } from "./context";

const t = ar.storefront;

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 @3xl:px-6", className)}>{children}</div>;
}

/** «الرئيسية › …»; the last item is the current page (no link). */
export function Breadcrumb({ items }: { items: Array<{ name: string; href?: string }> }) {
  const all = [{ name: t.home, href: "/" }, ...items];
  return (
    <nav aria-label={t.breadcrumb} className="as-xs as-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <ChevronLeft className="size-3.5" aria-hidden /> : null}
            {item.href && i < all.length - 1 ? (
              <StoreLink href={item.href} className="hover:underline">
                {item.name}
              </StoreLink>
            ) : (
              <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-(--as-text)">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-(--as-soft) as-primary">{icon}</span>
      <p className="as-lg font-bold">{title}</p>
      {text ? <p className="as-sm as-muted max-w-sm">{text}</p> : null}
      {action}
    </div>
  );
}

export function QuantityStepper({ value, onChange, max = 50, small = false, label = t.product.quantity }: { value: number; onChange: (v: number) => void; max?: number; small?: boolean; label?: string }) {
  const size = small ? "size-8" : "size-11";
  return (
    <div className="inline-flex items-center rounded-lg border" role="group" aria-label={label}>
      <button type="button" className={cn("flex items-center justify-center disabled:opacity-40", size)} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t.product.increase}>
        <Plus className="size-4" />
      </button>
      <span className={cn("min-w-8 text-center font-bold tabular-nums", small ? "as-sm" : "as-base")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={cn("flex items-center justify-center disabled:opacity-40", size)} onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label={t.product.decrease}>
        <Minus className="size-4" />
      </button>
    </div>
  );
}

/** A labelled field of the store forms (checkout, tracking). */
export function FormField({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string | null; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="as-sm font-semibold">
        {label} {optional ? <span className="as-xs as-muted font-normal">{t.checkout.optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="as-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="as-xs as-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = "as-base h-11 w-full rounded-lg border bg-(--as-bg) px-3 outline-none focus:border-(--as-primary) focus:ring-2 focus:ring-(--as-primary)/20 aria-invalid:border-red-500";

/** Read-only stars (a half star rounds to the nearest whole one). */
export function Stars({ value, size = "size-4", label }: { value: number; size?: string; label?: string }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? t.stars(full)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= full ? "fill-(--as-secondary) text-(--as-secondary)" : "text-(--as-line)")} aria-hidden />
      ))}
    </span>
  );
}

/** Choosing 1 to 5 stars (a radio group, keyboard friendly). */
export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={ar.storefront.account.star(n)} onClick={() => onChange(n)} className="rounded p-0.5">
          <Star className={cn("size-8 transition", n <= value ? "fill-(--as-secondary) text-(--as-secondary)" : "text-(--as-line) hover:text-(--as-secondary)")} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** A themed "are you sure?" box (sign out, delete). Esc or the backdrop cancels. */
export function ConfirmDialog({ title, text, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: { title: string; text?: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="as-confirm-title">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onCancel} aria-label={t.close} />
      <div className="relative flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-(--as-bg) p-5 shadow-2xl">
        <p id="as-confirm-title" className="as-lg font-extrabold">
          {title}
        </p>
        {text ? <p className="as-sm as-muted">{text}</p> : null}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onConfirm} disabled={busy} className={cn("as-btn as-sm h-10 flex-1 disabled:opacity-60", danger && "bg-red-600! text-white!")} autoFocus>
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className="as-sm h-10 flex-1 rounded-lg border font-semibold hover:bg-(--as-soft)">
            {ar.storefront.account.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
