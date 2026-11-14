"use client";

import { Check, Minus } from "lucide-react";
import * as React from "react";
import { CURRENCY, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { PublicPlan } from "./plans";

const t = ar.marketing.pricing;
type Period = "monthly" | "yearly";

/** The plan lines, from its real limits and features (the same numbers the billing enforces). */
export function planLines(plan: PublicPlan): Array<{ text: string; on: boolean }> {
  const v = plan.values;
  const n = (key: string) => (v[key] === null ? null : Number(v[key]));
  const on = (key: string) => v[key] === true;
  const L = t.lines;
  const lines: Array<{ text: string | null; on: boolean }> = [
    { text: on("store") ? L.store : L.noStore, on: true },
    { text: L.products(n("products")), on: true },
    { text: L.landing_pages(n("landing_pages")), on: true },
    { text: L.custom_domains(n("custom_domains")), on: true },
    { text: L.ab_tests(n("ab_tests")), on: true },
    { text: L.webhooks(n("webhooks")), on: true },
    { text: L.upsells, on: on("upsells") },
    { text: L.abandoned_leads, on: on("abandoned_leads") },
    { text: L.advanced_analytics, on: on("advanced_analytics") },
    { text: L.media(n("media_storage_mb")), on: true },
  ];
  if (on("remove_branding")) lines.push({ text: L.remove_branding, on: true });
  return lines.filter((l): l is { text: string; on: boolean } => l.text !== null);
}

export function Pricing({ plans, registerUrl }: { plans: PublicPlan[]; registerUrl: string }) {
  const [period, setPeriod] = React.useState<Period>("monthly");
  const yearlyOff = Math.max(0, ...plans.map((p) => p.prices.yearly?.discount_percent ?? 0));

  return (
    <>
      <div role="radiogroup" aria-label={t.label} className="mb-10 inline-flex rounded-xl border border-border bg-surface p-1 text-sm font-semibold" data-reveal>
        {(["monthly", "yearly"] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={cn("flex h-10 items-center gap-2 rounded-lg px-5 transition-colors duration-300", period === p ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}>
            {p === "monthly" ? t.monthly : t.yearly}
            {p === "yearly" && yearlyOff > 0 ? <span className="rounded bg-brand px-1.5 text-[11px] text-ink">{t.off(yearlyOff)}</span> : null}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const price = plan.prices[period] ?? plan.prices.monthly;
          const dark = plan.is_highlighted;
          return (
            <article key={plan.key} data-reveal style={{ "--d": `${i * 110}ms` } as React.CSSProperties} className={cn("relative flex flex-col rounded-[22px] border p-7 transition-transform duration-500 hover:-translate-y-1 md:p-8", dark ? "border-transparent bg-[var(--mk-deep)] text-white" : "border-border bg-surface")}>
              {dark ? <span className="absolute -top-3 start-7 rounded-full bg-brand px-3 py-1 text-xs font-bold text-ink">{t.popular}</span> : null}
              <h3 className="font-display text-[28px] font-semibold">{plan.name}</h3>
              <p className={cn("mt-1 min-h-10 text-sm", dark ? "text-white/60" : "text-ink-3")}>{plan.tagline}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span key={period} className="mk-price font-display text-6xl font-semibold tracking-tight tabular">
                  {formatNumber(price?.final ?? 0)}
                </span>
                <span className="text-lg">{CURRENCY}</span>
                <span className={cn("text-sm", dark ? "text-white/60" : "text-ink-3")}>{period === "monthly" ? t.perMonth : t.perYear}</span>
              </p>
              <p className={cn("mt-1 h-5 text-sm", dark ? "text-white/60" : "text-ink-3")}>{price && price.final < price.original ? <s>{t.was(price.original)}</s> : null}</p>
              <a href={`${registerUrl}${registerUrl.includes("?") ? "&" : "?"}plan=${plan.key}`} className={cn("mk-btn mt-6 h-12 w-full", dark ? "mk-btn-mint" : i === plans.length - 1 ? "mk-btn-ink" : "mk-btn-line")}>
                {t.start(plan.name)}
              </a>
              <ul className="mt-7 flex flex-col">
                {planLines(plan).map((line) => (
                  <li key={line.text} className={cn("flex items-center gap-2.5 border-t py-2.5 text-[15px]", dark ? "border-white/10" : "border-border", !line.on && (dark ? "text-white/40" : "text-ink-3"))}>
                    {line.on ? <Check className="size-4 shrink-0 text-brand" aria-hidden /> : <Minus className="size-4 shrink-0" aria-hidden />}
                    {line.text}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-2" data-reveal>
        {t.notes.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </p>
    </>
  );
}
