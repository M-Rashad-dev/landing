import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { parseCart } from "@/lib/store/cart";
import { applyRecovered, recoveryToken, type Recovered } from "@/lib/store/recovery";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { CartRecoveryPanel, type RecoveryState } from "./cart-recovery-panel";

const t = ar.orders.recovery;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const base: RecoveryState = {
  whatsapp_available: true,
  enabled: false,
  whatsapp: true,
  email: true,
  first_minutes: 60,
  second_hours: 24,
  coupon_mode: "none",
  discount_code_id: null,
  coupon_type: "percentage",
  coupon_value: null,
  codes: [],
  balance: 0,
  packs: [
    { messages: 100, price: 100 },
    { messages: 500, price: 450 },
  ],
  pending: null,
  quiet_hours: { from: 23, to: 9 },
  stats: { reminders: 14, whatsapp: 10, email: 4, recovered: 3, revenue: 1250 },
};

function wrap(permissions: string[] = ["*"]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "م", role: "owner", permissions }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>
          <CartRecoveryPanel />
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("cart reminders", () => {
  it("shows the numbers and the balance, and buys a pack through billing", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: base }));
    wrap();
    expect(await screen.findByText(formatMoney(1250))).toBeInTheDocument();
    expect(screen.getByText(t.messages(0))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.buy })).toHaveAttribute("href", "/dashboard/settings/billing/checkout?messages=500");
  });

  it("turns it on with a one-time code in the second reminder", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: base }));
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(t.turnOn) }));
    fireEvent.click(screen.getByText(t.couponModes.generated.title));
    fireEvent.change(screen.getByLabelText(t.percentValue), { target: { value: "10" } });
    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...base, enabled: true, coupon_mode: "generated", coupon_value: 10 } }));
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toContain("/dashboard/leads/recovery");
    expect(JSON.parse(String(init.body))).toMatchObject({ enabled: true, first_minutes: 60, second_hours: 24, coupon_mode: "generated", coupon_value: "10", discount_code_id: null });
  });

  it("hides the settings and buying from staff without them", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: base }));
    wrap(["abandoned.view"]);
    expect(await screen.findByText(t.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(t.turnOn) })).toBeNull();
    expect(screen.queryByRole("link", { name: t.buy })).toBeNull();
  });

  it("refills the store cart from a reminder's link", () => {
    expect(recoveryToken("?r=55ea3ad4789fe59624cba285")).toBe("55ea3ad4789fe59624cba285");
    expect(recoveryToken("?r=bad")).toBeNull();
    const data: Recovered = {
      kind: "store",
      items: [{ product_id: 4, quantity: 2, options: { "7": 21 }, name: "تيشيرت", slug: "t", image: null, price: 200, options_label: "المقاس: L", digital: false }],
      customer: { name: "سارة", phone: "+201011113333", email: null },
      quantity: 2,
    };
    window.history.replaceState(null, "", "/checkout?r=55ea3ad4789fe59624cba285");
    applyRecovered(data);
    const cart = parseCart(window.localStorage.getItem("as_cart_v1"));
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ product_id: 4, quantity: 2, options: { "7": 21 }, options_label: "المقاس: L" });
    expect(window.location.search).toBe("");
  });
});
