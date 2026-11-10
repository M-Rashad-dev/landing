"use client";

import { PricingCards } from "@/components/billing/pricing-cards";
import { Button } from "@/components/ui/button";
import type { EntitlementInfo, PricingPlan } from "@/lib/billing/types";
import { ar } from "@/messages/ar";

/** Pricing on the marketing page: every plan leads to sign-up (the free trial starts there). */
export function MarketingPricing({ plans, entitlements, registerUrl }: { plans: PricingPlan[]; entitlements: EntitlementInfo[]; registerUrl: string }) {
  return (
    <PricingCards
      plans={plans}
      entitlements={entitlements}
      action={(plan) => (
        <Button variant={plan.is_highlighted ? "gold" : "outline"} className="w-full" asChild>
          <a href={registerUrl}>{ar.marketing.start}</a>
        </Button>
      )}
    />
  );
}
