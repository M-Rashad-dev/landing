"use client";

import { Banknote, Check, CreditCard, Landmark, Link2, Smartphone, Wallet } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.storefront.payment;

/** How a checkout can be paid (back: StorePayments::options). */
export type PaymentOptions = { cod: boolean; methods: Array<{ id: number; kind: "instapay" | "wallet" | "bank" | "link" | "online"; name: string; account?: string | null; link?: string | null; instructions?: string | null }> };

const ICONS = { instapay: Wallet, wallet: Smartphone, bank: Landmark, link: Link2, online: CreditCard } as const;

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
 * Cash on delivery or one of the store's prepaid methods, drawn with the theme's own colors (--as-*). `detail` shows
 * right under the chosen one (a transfer's number and its receipt at the store checkout).
 */
export function PaymentChoice({ options, value, onChange, error, className, detail, legend = true }: { options: PaymentOptions; value: string; onChange: (v: string) => void; error?: string | null; className?: string; detail?: React.ReactNode; legend?: boolean }) {
  const rows = [...(options.cod ? [{ value: "cod", title: t.cod, hint: t.codHint, icon: Banknote }] : []), ...options.methods.map((m) => ({ value: String(m.id), title: m.name, hint: m.kind === "online" ? t.onlineHint : detail !== undefined ? t.prepaidHereHint : t.prepaidHint, icon: ICONS[m.kind] ?? CreditCard }))];
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)} data-field="payment_method">
      {legend ? <legend className="as-sm mb-1 font-bold">{t.title}</legend> : null}
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.title}>
        {rows.map((row) => {
          const on = row.value === value;
          const Icon = row.icon;
          return (
            <div key={row.value} className="flex min-w-0 flex-col gap-2">
            <button
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
            {on && detail ? detail : null}
            </div>
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

/**
 * After a prepaid order: pay now and send the receipt (the pay page of the order). `receipt` = the receipt picked at
 * checkout arrived (the store reviews it) or did not (send it again from the pay page).
 */
export function PayNowBox({ href, receipt = null }: { href: string; receipt?: "sent" | "failed" | null }) {
  if (receipt === "sent") {
    return (
      <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-(--as-soft) p-4 text-center">
        <p className="as-sm font-bold">{t.receiptSent}</p>
        <a href={href} className="as-sm font-semibold text-(--as-primary) hover:underline">
          {t.followPayment}
        </a>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-(--as-primary) p-4 text-center">
      <p className="as-sm font-bold">{receipt === "failed" ? t.receiptFailed : t.payNow}</p>
      <a href={href} className="as-btn as-base h-12 w-full">
        {t.payButton}
      </a>
    </div>
  );
}
