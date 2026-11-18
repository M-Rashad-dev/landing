import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { AiWallet } from "./ai-wallet-api";
import { bonusFor } from "./ai-wallet-api";
import { AiWalletPage } from "./ai-wallet-page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/settings/ai", useSearchParams: () => new URLSearchParams() }));

const t = ar.settings.aiWallet;
let wallet: AiWallet;


beforeEach(() => {
  push.mockReset();

  wallet = {
    balance: 60,
    free: 10,
    paid: 50,
    spendable: 60,
    paid_allowed: true,
    packages: [100, 250, 500, 1000],
    min: 50,
    offers: [
      { min: 500, bonus: 25 },
      { min: 1000, bonus: 100 },
    ],
    low_balance: 10,
    month: { spent: 3.3, by_feature: [] },
    pending: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input).replace(/^\/api\/bff/, "");
      if (url.startsWith("/dashboard/ai/wallet/entries")) {

        return Response.json({
          data: [
            { id: 2, type: "charge", amount: -0.55, balance_after: 9.45, feature: "sections", description: "سيكشن التصنيفات", created_at: "2026-11-18T10:00:00Z" },
            { id: 1, type: "welcome", amount: 10, balance_after: 10, feature: null, description: null, created_at: "2026-11-17T10:00:00Z" },
          ],
          meta: { current_page: 1, last_page: 1, per_page: 30, total: 2 },
        });
      }
      return Response.json({ data: wallet });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <AiWalletPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );

describe("AI balance (settings)", () => {
  it("takes the biggest offer a top-up reaches", () => {
    expect(bonusFor(wallet.offers, 499)).toBe(0);
    expect(bonusFor(wallet.offers, 500)).toBe(25);
    expect(bonusFor(wallet.offers, 2500)).toBe(100);
  });

  it("shows the balance and its moves, and goes to the checkout with the chosen package", async () => {
    show();
    expect(await screen.findByText(formatMoney(60))).toBeInTheDocument();
    expect(await screen.findByText("سيكشن التصنيفات")).toBeInTheDocument();
    expect(screen.getByText(t.types.welcome!)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: new RegExp(formatMoney(500).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }));
    expect(screen.getByText(t.youGet(formatMoney(525)))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.pay }));
    expect(push).toHaveBeenCalledWith("/dashboard/settings/billing/checkout?ai=500");
  });

  it("takes a free amount from the least one, and refuses less", async () => {
    show();
    const input = await screen.findByLabelText(t.custom, { exact: false });
    fireEvent.change(input, { target: { value: "30" } });
    expect(screen.getByText(t.belowMin(formatMoney(50)))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.pay })).toBeDisabled();

    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: t.pay }));
    expect(push).toHaveBeenCalledWith("/dashboard/settings/billing/checkout?ai=75");
  });

  it("on a plan without the AI: no top-up, a way to the plans", async () => {
    wallet = { ...wallet, paid_allowed: false, spendable: 10 };
    show();
    expect(await screen.findByText(t.planLocked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.pay })).toBeNull();
    expect(screen.getByText(t.paidLocked)).toBeInTheDocument();
  });

  it("warns when the balance is low and waits for a top-up under review", async () => {
    wallet = { ...wallet, balance: 8, free: 8, paid: 0, spendable: 8, pending: { id: 4, number: "INV-000004", status: "pending_review", total: 250 } };
    show();
    expect(await screen.findByText(t.low(formatMoney(8)))).toBeInTheDocument();
    expect(screen.getByText(t.pending("INV-000004"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.pay })).toBeDisabled();
  });
});
