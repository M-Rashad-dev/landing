"use client";

import { Check, Crown, Minus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BillingPeriod, EntitlementInfo, PlanQuote, PricingPlan } from "@/lib/billing/types";
import { formatCairo } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.billing.pricing;

/** Yearly saving vs 12 monthly payments, when both periods are sold. */
export function yearlySaving(plans: PricingPlan[]): number {
  let best = 0;
  for (const plan of plans) {
    const m = plan.prices.monthly?.final;
    const y = plan.prices.yearly?.final;
    if (m && y && m * 12 > y) best = Math.max(best, Math.round((1 - y / (m * 12)) * 100));
  }
  return best;
}

export function valueText(info: EntitlementInfo, value: number | boolean | null): ReactNode {
  if (info.kind === "feature") {
    return value ? <Check className="mx-auto size-4 text-success" aria-label={t.included} /> : <Minus className="mx-auto size-4 text-muted-foreground" aria-label={t.notIncluded} />;
  }
  if (value === null) return ar.billing.unlimited;
  return formatNumber(value as number);
}

/**
 * Plan cards with a monthly / yearly switch and a comparison table. The action under each
 * price is given by the caller (dashboard: change price + choose; marketing: sign up).
 */
export function PricingCards({
  plans,
  entitlements,
  action,
}: {
  plans: PricingPlan[];
  entitlements: EntitlementInfo[];
  action: (plan: PricingPlan, quote: PlanQuote) => ReactNode;
}) {
  const periods = (["monthly", "yearly"] as BillingPeriod[]).filter((p) => plans.some((plan) => plan.prices[p]));
  const [period, setPeriod] = useState<BillingPeriod>(periods[0] ?? "monthly");
  const saving = yearlySaving(plans);

  return (
    <div className="flex flex-col gap-8">
      {periods.length > 1 ? (
        <Tabs value={period} onValueChange={(v) => setPeriod(v as BillingPeriod)} className="self-center">
          <TabsList>
            <TabsTrigger value="monthly">{t.monthly}</TabsTrigger>
            <TabsTrigger value="yearly">
              {t.yearly}
              {saving > 0 ? (
                <Badge variant="gold" className="ms-2">
                  {t.save(saving)}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const quote = plan.prices[period];
          return (
            <li key={plan.key}>
              <Card className={cn("relative flex h-full flex-col gap-4 p-6", plan.is_highlighted && "border-gold shadow-md ring-1 ring-gold/40")}>
                {plan.is_highlighted ? (
                  <Badge variant="gold" className="absolute -top-3 start-6">
                    <Crown aria-hidden />
                    {t.highlighted}
                  </Badge>
                ) : null}
                <div>
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  {plan.tagline ? <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p> : null}
                </div>

                {quote ? (
                  <div>
                    <p className="flex items-baseline gap-2">
                      <span className="font-display text-3xl font-extrabold tabular-nums">{formatPrice(quote.final)}</span>
                      <span className="text-sm text-muted-foreground">{ar.billing.perPeriod[period]}</span>
                    </p>
                    {quote.discount_percent > 0 ? (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground line-through">{formatPrice(quote.original)}</span>
                        <Badge variant="success">-{quote.discount_percent}%</Badge>
                        {quote.discount_ends_at ? <span className="text-xs text-muted-foreground">{t.discountEnds(formatCairo(quote.discount_ends_at, { withTime: false }))}</span> : null}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}

                <ul className="flex flex-1 flex-col gap-2 text-sm">
                  {entitlements.map((info) => {
                    const value = plan.values[info.key as keyof typeof plan.values];
                    if (info.kind === "feature" && !value) return null;
                    return (
                      <li key={info.key} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-success" aria-hidden />
                        <span>
                          {info.label}
                          {info.kind === "limit" ? <span className="font-semibold">: {valueText(info, value as number | null)}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                  {plan.marketing_points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-success" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>

                {quote ? <div className="mt-auto">{action(plan, quote)}</div> : null}
              </Card>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="compare-title">
        <h2 id="compare-title" className="mb-3 font-display text-lg font-bold">
          {t.compare}
        </h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-start font-semibold">{t.feature}</th>
                {plans.map((plan) => (
                  <th key={plan.key} className="px-4 py-3 text-center font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entitlements.map((info) => (
                <tr key={info.key} className="border-b last:border-0">
                  <td className="px-4 py-2.5">{info.label}</td>
                  {plans.map((plan) => (
                    <td key={plan.key} className="px-4 py-2.5 text-center tabular-nums">
                      {valueText(info, plan.values[info.key as keyof typeof plan.values])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
