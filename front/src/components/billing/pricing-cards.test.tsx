import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { changeText } from "@/app/(dashboard)/dashboard/plans/pricing-view";
import type { EntitlementInfo, PricingPlan } from "@/lib/billing/types";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";
import { PricingCards, yearlySaving } from "./pricing-cards";

const entitlements: EntitlementInfo[] = [
  { key: "products", kind: "limit", label: "المنتجات" },
  { key: "upsells", kind: "feature", label: "عروض ما بعد الطلب" },
];

const values = (products: number | null, upsells: boolean) =>
  ({ products, landing_pages: 1, custom_domains: 0, media_storage_mb: 1, offers: 1, discount_codes: 1, webhooks: 0, ab_tests: 0, upsells, abandoned_leads: false, advanced_analytics: false, remove_branding: false }) as PricingPlan["values"];

const plans: PricingPlan[] = [
  {
    key: "basic",
    name: "بيسك",
    tagline: null,
    description: null,
    marketing_points: [],
    is_highlighted: false,
    prices: {
      monthly: { plan_key: "basic", period: "monthly", original: 50, discount_percent: 0, final: 50, discount_ends_at: null },
      yearly: { plan_key: "basic", period: "yearly", original: 600, discount_percent: 0, final: 600, discount_ends_at: null },
    },
    values: values(5, false),
  },
  {
    key: "pro",
    name: "برو",
    tagline: "للبيع",
    description: null,
    marketing_points: ["دعم واتساب"],
    is_highlighted: true,
    prices: {
      monthly: { plan_key: "pro", period: "monthly", original: 100, discount_percent: 20, final: 80, discount_ends_at: null },
      yearly: { plan_key: "pro", period: "yearly", original: 1200, discount_percent: 0, final: 960, discount_ends_at: null },
    },
    values: values(null, true),
  },
];

describe("PricingCards", () => {
  it("shows prices with the discount, the plan values and switches to yearly", () => {
    render(<PricingCards plans={plans} entitlements={entitlements} action={(plan) => <button type="button">اختار {plan.name}</button>} />);

    expect(screen.getByText(formatPrice(80))).toBeInTheDocument();
    expect(screen.getByText(formatPrice(100))).toBeInTheDocument();
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getAllByText(ar.billing.unlimited).length).toBeGreaterThan(0);
    expect(screen.getByText("دعم واتساب")).toBeInTheDocument();
    expect(screen.getByText("اختار برو")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: new RegExp(ar.billing.pricing.yearly) }));
    expect(screen.getByText(formatPrice(960))).toBeInTheDocument();
  });

  it("computes the best yearly saving", () => {
    // pro: 80 × 12 = 960 → yearly 960 = 0%; basic 0%.
    expect(yearlySaving(plans)).toBe(0);
    expect(yearlySaving([{ ...plans[1], prices: { monthly: plans[1].prices.monthly, yearly: { ...plans[1].prices.yearly!, final: 816 } } }])).toBe(15);
  });
});

describe("changeText", () => {
  const quote = plans[1].prices.monthly!;

  it("explains the difference, the full price or a queued start", () => {
    expect(changeText({ ...quote, change: { pay: 50, credit: 100, starts_now: true } })).toBe(ar.billing.pricing.difference(formatPrice(50)));
    expect(changeText({ ...quote, change: { pay: 80, credit: 0, starts_now: true } })).toBe(ar.billing.pricing.payNow(formatPrice(80)));
    expect(changeText({ ...quote, change: { pay: 80, credit: 0, starts_now: false } })).toBe(ar.billing.pricing.afterCurrent);
  });
});
