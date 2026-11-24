import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { EMPTY, toPayload } from "@/features/catalog/products/form-model";
import { ProfitCard } from "@/features/orders/profit-card";
import type { OrderDetail } from "@/features/orders/api";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { ProfitData } from "./api";
import { ProfitPage } from "./profit-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/profit", useSearchParams: () => new URLSearchParams() }));

const totals = { orders: 2, revenue: 4500, product_cost: 2400, shipping_cost: 400, cod_fee: 90, packaging: 50, losses: 75, profit: 1485 };
const report: ProfitData = {
  from: "2026-11-01",
  to: "2026-11-10",
  actual: totals,
  expected: { ...totals, orders: 3, profit: 2222 },
  expenses: { total: 500, by_kind: [{ kind: "ads_facebook", label: "إعلانات فيسبوك وانستجرام", amount: 500 }] },
  net_profit: 985,
  margin: 21.9,
  missing_cost_orders: 1,
  chart: [{ date: "2026-11-10", profit: 1485, expenses: 500, net: 985 }],
  products: [{ product_id: 1, name: "قميص قطن", units: 4, revenue: 800, cost: 480, profit: 320, margin: 40, cost_known: true }],
  sources: [{ source: "facebook", orders: 2, revenue: 4500, profit: 1485, ad_spend: 500, net: 985, roas: 9 }],
};

beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/profit/expenses")) return Response.json({ data: [{ id: 1, spent_on: "2026-11-09", kind: "rent", kind_label: "إيجار", amount: 1000, note: "المخزن" }], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } });
      if (url.includes("/profit/settings")) return Response.json({ data: { packaging_cost: 5, kinds: [] } });
      return Response.json({ data: report });
    }),
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("profit", () => {
  it("shows net, actual and expected profit, ROAS, products and the expenses", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <ProfitPage />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const t = ar.profit;
    expect((await screen.findAllByText(formatMoney(985))).length).toBeGreaterThan(0);
    expect(screen.getByText(formatMoney(2222))).toBeInTheDocument();
    expect(screen.getByText(t.missingCost(1))).toBeInTheDocument();
    expect(screen.getByText("9x")).toBeInTheDocument();
    expect(screen.getByText("قميص قطن")).toBeInTheDocument();
    expect(await screen.findByText("إيجار")).toBeInTheDocument();
    expect(await screen.findByText(t.packaging.title)).toBeInTheDocument();
  });

  it("sends the product cost only for whoever may see it", () => {
    expect(toPayload({ ...EMPTY, name: "قميص", price: "200", cost: "120" })).not.toHaveProperty("cost");
    expect(toPayload({ ...EMPTY, name: "قميص", price: "200", cost: "120" }, true)).toMatchObject({ cost: "120" });
  });

  it("shows an order's profit or loss", () => {
    const order = { profit: { revenue: 450, product_cost: 240, shipping_cost: 40, cod_fee: 9, packaging: 5, profit: 156, loss: false, cost_known: false } } as unknown as OrderDetail;
    render(<ProfitCard order={order} />);
    expect(screen.getByText(formatMoney(156))).toBeInTheDocument();
    expect(screen.getByText(ar.profit.order.noCost)).toBeInTheDocument();
    cleanup();
    render(<ProfitCard order={{} as OrderDetail} />);
    expect(screen.queryByText(ar.profit.order.title)).toBeNull();
  });
});
