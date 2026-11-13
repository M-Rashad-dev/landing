import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { AnalyticsPage, type Analytics } from "./analytics-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/analytics", useSearchParams: () => new URLSearchParams() }));

const totals = { views: 200, product_views: 120, add_to_cart: 30, checkouts: 12, orders: 8, revenue: 4000, average_order: 500, conversion: 4, cart_rate: 15, checkout_rate: 66.67, delivered: 5, customers: 7, new_customers: 4, returning_customers: 3, abandoned: 6, recovered: 2 };
const data: Analytics = {
  range: { from: "2026-11-01", to: "2026-11-10", days: 10, previous_from: "2026-10-22", previous_to: "2026-10-31" },
  totals,
  previous: { ...totals, orders: 4, revenue: 2000 },
  days: [{ date: "2026-11-10", views: 20, product_views: 10, add_to_cart: 3, checkouts: 1, orders: 1, revenue: 500 }],
  sources: [{ source: "facebook", views: 150, orders: 6, revenue: 3000, conversion: 4 }, { source: "direct", views: 50, orders: 2, revenue: 1000, conversion: 4 }],
  devices: [{ device: "mobile", views: 150 }, { device: "desktop", views: 50 }],
  top_products: [{ product_id: 1, name: "ساعة ذكية", units: 9, orders: 6, revenue: 3600, image: null }],
  governorates: [{ governorate: "الجيزة", orders: 5, revenue: 2500 }],
  hours: Array.from({ length: 24 }, (_, h) => (h === 21 ? 5 : h === 10 ? 1 : 0)),
};

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data }))));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("analytics", () => {
  it("shows the numbers against the previous period, the sources, products and the busiest hour", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <AnalyticsPage />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const t = ar.analytics;
    expect(await screen.findByText(formatMoney(4000))).toBeInTheDocument();
    expect(screen.getByText(t.sources.names.facebook)).toBeInTheDocument();
    expect(screen.getByText("ساعة ذكية")).toBeInTheDocument();
    expect(screen.getByText(t.kpis.recovered(2))).toBeInTheDocument();
    expect(screen.getByText(t.hours.peak(t.hours.hour(21)))).toBeInTheDocument();
    expect(screen.getAllByText(t.funnel.addToCart).length).toBeGreaterThan(0);
  });
});
