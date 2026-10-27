"use client";

import { Check, PackageCheck, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPhoneLocal } from "@/lib/format/phone";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { TRACK_PHONE_KEY } from "@/themes/shared/hooks/use-order-form";

const t = siteMessages.track;
const STEPS = ["received", "confirmed", "delivered"] as const;

type Tracked = {
  order_number: number;
  stage: "received" | "confirmed" | "delivered" | "returned" | "cancelled";
  created_at: string;
  items: Array<{ name: string; quantity: number; options: string[] }>;
  total: number;
  history: Array<{ stage: string; at: string }>;
};

const dateTime = (iso: string) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(iso));

/** Order number + phone → the order's stage as a 3-step progress, in the store's look. */
export function TrackForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Tracked | null>(null);

  // ?order=1024 from the success screen, and the phone used in this tab.
  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order") ?? "";
    let saved = "";
    try {
      saved = window.sessionStorage.getItem(TRACK_PHONE_KEY) ?? "";
    } catch {
      // Storage blocked.
    }
    const frame = requestAnimationFrame(() => {
      if (/^\d{1,9}$/.test(order)) setOrderNumber(order);
      if (saved) setPhone(formatPhoneLocal(saved));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/public/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: Number(orderNumber.replace(/[^\d]/g, "")), phone }),
      });
      if (response.ok) setResult(((await response.json()) as { data: Tracked }).data);
      else setError(response.status === 429 ? t.tooMany : t.notFound);
    } catch {
      setError(siteMessages.networkError);
    } finally {
      setBusy(false);
    }
  }

  if (result) return <Result order={result} onReset={() => setResult(null)} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="t-heading text-3xl font-bold">{t.title}</h1>
        <p className="t-muted mt-2">{t.intro}</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.orderNumber}
        <input className="t-input h-12 rounded-xl px-4 tabular-nums" inputMode="numeric" dir="ltr" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="1024" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.phone}
        <input className="t-input h-12 rounded-xl px-4 text-start" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
      </label>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy || !orderNumber.trim() || !phone.trim()} className="t-primary t-btn h-12 font-bold transition-opacity disabled:opacity-60">
        {busy ? siteMessages.sending : t.submit}
      </button>
    </form>
  );
}

function Result({ order, onReset }: { order: Tracked; onReset: () => void }) {
  const ended = order.stage === "cancelled" || order.stage === "returned";
  const current = STEPS.indexOf(order.stage as (typeof STEPS)[number]);
  const reachedAt = (stage: string) => order.history.find((h) => h.stage === stage)?.at;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-heading text-2xl font-bold tabular-nums">{siteMessages.orderNumber(order.order_number)}</h1>
        <PackageCheck className="t-primary-text size-8" aria-hidden />
      </div>

      {ended ? (
        <p className="flex items-center gap-2 rounded-xl bg-black/5 px-4 py-3 font-semibold">
          {order.stage === "cancelled" ? <XCircle className="size-5" aria-hidden /> : <RotateCcw className="size-5" aria-hidden />}
          {order.stage === "cancelled" ? t.cancelled : t.returned}
        </p>
      ) : (
        <ol className="flex flex-col gap-0">
          {STEPS.map((step, index) => {
            const done = index <= current;
            const at = reachedAt(step);
            return (
              <li key={step} className="relative flex gap-4 pb-7 last:pb-0">
                {index < STEPS.length - 1 ? <span className={cn("absolute start-[15px] top-8 h-[calc(100%-2rem)] w-0.5", index < current ? "t-primary" : "bg-black/10")} aria-hidden /> : null}
                <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors", done ? "t-primary border-transparent" : "t-border bg-transparent")}>
                  {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <span className="size-2 rounded-full bg-black/20" aria-hidden />}
                </span>
                <span className="pt-1">
                  <span className={cn("block font-semibold", !done && "t-muted")}>{t.stages[step]}</span>
                  {at ? <span className="t-muted block text-sm">{dateTime(at)}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="t-tint rounded-2xl p-4">
        <ul className="flex flex-col gap-1 text-sm">
          {order.items.map((item, i) => (
            <li key={i}>
              {item.quantity} × <span className="font-semibold">{item.name}</span>
              {item.options.length ? <span className="t-muted"> ({item.options.join("، ")})</span> : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-black/10 pt-3 font-bold">
          <span>{t.total}</span>
          <span className="tabular-nums">{formatPrice(order.total)}</span>
        </p>
        <p className="t-muted mt-1 text-xs">{siteMessages.cod}</p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <button type="button" onClick={onReset} className="t-primary-text underline-offset-4 hover:underline">
          {t.another}
        </button>
        <Link href="/" className="t-muted underline-offset-4 hover:underline">
          {t.backToStore}
        </Link>
      </div>
    </div>
  );
}
