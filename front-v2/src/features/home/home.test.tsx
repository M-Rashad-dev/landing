import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { HomePage } from "./home-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));

const kpis = { orders: 10, sales: 5000, delivered_sales: 3000, average_order: 500, confirmation_rate: 80, delivery_rate: 90, return_rate: 10, new_customers: 4 };
const home = {
  range: { from: "2026-10-22", to: "2026-11-20", days: 30, previous_from: "2026-09-22", previous_to: "2026-10-21" },
  kpis,
  previous: { ...kpis, sales: 4000 },
  chart: [{ date: "2026-11-20", orders: 2, sales: 900 }],
  statuses: { new: 1, confirmed: 2, shipped: 0, delivered: 6, returned: 1, damaged: 0, fake: 0, cancelled: 0 },
  top_products: [{ product_id: 1, name: "ساعة", units: 12, sales: 4800 }],
  top_governorates: [{ governorate: "القاهرة", orders: 7, sales: 3500 }],
  sources: { store: { orders: 6, sales: 3000 }, landing: { orders: 4, sales: 2000 } },
  latest_orders: [],
  todo: { to_confirm: 3, stale_shipments: 0, abandoned: null, out_of_stock: 1, low_stock: 0, ending_promotions: 0 },
  setup: {
    steps: [
      { key: "product", done: true, optional: false },
      { key: "shipping", done: false, optional: false },
      { key: "domain", done: false, optional: true },
    ],
    done: false,
  },
};

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: home }))));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HomePage", () => {
  it("shows the period numbers, what needs doing, and an optional domain step", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <SessionProvider value={{ user: { name: "محمد رشاد" }, tenant: null, plan: null, store_name: "نعناع", storeUrl: null } as never}>
            <HomePage />
          </SessionProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(ar.home.todo.toConfirm(3))).toBeInTheDocument();
    expect(screen.getByText(ar.home.todo.out(1))).toBeInTheDocument();
    expect(screen.getByText(`${ar.home.setup.steps.domain} (${ar.home.setup.optional})`)).toBeInTheDocument();
    expect(screen.getByText("5,000 ج.م")).toBeInTheDocument();
    expect(screen.getByText("+25%")).toBeInTheDocument(); // 5000 vs 4000
    expect(screen.getByText(ar.home.greeting("محمد"))).toBeInTheDocument();
  });
});
