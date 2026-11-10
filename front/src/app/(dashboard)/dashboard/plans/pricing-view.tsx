"use client";

import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { useBillingPlans } from "@/lib/billing/api";
import { createInvoice } from "@/lib/billing/payments";
import type { PlanQuote } from "@/lib/billing/types";
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
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useBillingPlans();
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(quote: PlanQuote) {
    setBusy(`${quote.plan_key}:${quote.period}`);
    try {
      const invoice = await createInvoice(quote.plan_key, quote.period);
      router.push(`/dashboard/billing/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

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
            <Button variant={plan.is_highlighted ? "gold" : "default"} className="w-full" loading={busy === `${quote.plan_key}:${quote.period}`} disabled={busy !== null} onClick={() => choose(quote)}>
              <Crown />
              {t.choose}
            </Button>
          </div>
        )
      }
    />
  );
}
