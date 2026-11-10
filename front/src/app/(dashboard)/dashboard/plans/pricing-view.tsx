"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingPlans } from "@/lib/billing/api";
import type { PlanQuote, PricingPlan } from "@/lib/billing/types";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.billing.pricing;

/** What choosing this price means now: the difference, the full price, or after the current period. */
export function changeText(quote: PlanQuote): string {
  if (!quote.change) return "";
  if (!quote.change.starts_now) return t.afterCurrent;
  if (quote.change.credit > 0) return t.difference(formatPrice(quote.change.pay));
  return t.payNow(formatPrice(quote.change.pay));
}

export function PricingView() {
  const { data, isPending, isError, error, refetch } = useBillingPlans();
  const [chosen, setChosen] = useState<{ plan: PricingPlan; quote: PlanQuote } | null>(null);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-96 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PricingCards
        plans={data.plans}
        entitlements={data.entitlements}
        action={(plan, quote) =>
          quote.is_current ? (
            <Button variant="outline" className="w-full" disabled>
              {t.current}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs text-muted-foreground">{changeText(quote)}</p>
              <Button variant={plan.is_highlighted ? "gold" : "default"} className="w-full" onClick={() => setChosen({ plan, quote })}>
                <Crown />
                {t.choose}
              </Button>
            </div>
          )
        }
      />

      <Dialog open={chosen !== null} onOpenChange={(open) => (!open ? setChosen(null) : undefined)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{chosen ? t.requestTitle(chosen.plan.name) : ""}</DialogTitle>
            <DialogDescription>
              {chosen ? `${changeText(chosen.quote)}. ` : ""}
              {t.requestText}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setChosen(null)}>{t.ok}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
