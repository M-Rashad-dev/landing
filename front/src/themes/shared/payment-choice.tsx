"use client";

import { Banknote, Check, CreditCard, Landmark, Link2, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.storefront.payment;

/** How a checkout can be paid (back: StorePayments::options). */
export type PaymentOptions = { cod: boolean; methods: Array<{ id: number; kind: "instapay" | "wallet" | "bank" | "link"; name: string }> };

const ICONS = { instapay: Wallet, wallet: Smartphone, bank: Landmark, link: Link2 } as const;

/** The first choice offered: cash on delivery when it is on, else the first prepaid method. */
export function defaultPayment(options: PaymentOptions | undefined): string {
  if (!options || options.cod || options.methods.length === 0) return "cod";
  return String(options.methods[0].id);
}

/** True when the customer has something to choose (more than cash on delivery alone). */
export function hasPaymentChoice(options: PaymentOptions | undefined): options is PaymentOptions {
  return Boolean(options && options.methods.length > 0);
}

/**
 * Cash on delivery or one of the store's prepaid methods, drawn with the theme's own colors (--as-*). A prepaid
 * choice says the customer pays first and sends the receipt on the next page.
 */
export function PaymentChoice({ options, value, onChange, error, className }: { options: PaymentOptions; value: string; onChange: (v: string) => void; error?: string | null; className?: string }) {
  const rows = [...(options.cod ? [{ value: "cod", title: t.cod, hint: t.codHint, icon: Banknote }] : []), ...options.methods.map((m) => ({ value: String(m.id), title: m.name, hint: t.prepaidHint, icon: ICONS[m.kind] ?? CreditCard }))];
  return (
    <fieldset className={cn("flex flex-col gap-2", className)} data-field="payment_method">
      <legend className="as-sm mb-1 font-bold">{t.title}</legend>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.title}>
        {rows.map((row) => {
          const on = row.value === value;
          const Icon = row.icon;
          return (
            <button
              key={row.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(row.value)}
              className={cn("flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-start transition", on ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/50")}
            >
              <Icon className="size-5 shrink-0 opacity-80" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="as-sm font-bold">{row.title}</span>
                <span className="as-xs as-muted">{row.hint}</span>
              </span>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-(--as-primary) bg-(--as-primary) text-(--as-on-primary)" : "")}>{on ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="as-xs font-bold text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** After a prepaid order: pay now and send the receipt (the pay page of the order). */
export function PayNowBox({ href }: { href: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-(--as-primary) p-4 text-center">
      <p className="as-sm font-bold">{t.payNow}</p>
      <a href={href} className="as-btn as-base h-12 w-full">
        {t.payButton}
      </a>
    </div>
  );
}
