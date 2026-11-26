import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { parseCart } from "@/lib/store/cart";
import { applyRecovered, recoveryToken, type Recovered } from "@/lib/store/recovery";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { AbandonedPage, type Lead } from "./abandoned-page";
import { CartRecoveryPanel, type RecoveryState } from "./cart-recovery-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/abandoned", useSearchParams: () => new URLSearchParams("kind=cart") }));

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

describe("manual reminders on the abandoned page", () => {
  const lead = (id: number, extra: Partial<Lead> = {}): Lead => ({
    id, customer_name: `عميل ${id}`, customer_phone: `+20101111000${id}`, customer_id: null, governorate: null, quantity: 1, status: "open", page: null, product: null,
    source: "cart", cart: { items: [{ product_id: 1, name: "قميص", quantity: 1 }], total: 300 }, order: null, contacted_at: null, last_seen_at: null, created_at: new Date().toISOString(), ...extra,
  });

  function route(rows: Lead[]) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/leads/recovery/remind")) return Response.json({ data: { count: init?.body ? (JSON.parse(String(init.body)).ids?.length ?? 2) : 2 } }, { status: 202 });
      if (String(url).includes("/leads/recovery")) return Response.json({ data: { ...base, balance: 50 } });
      return Response.json({ data: rows, meta: { current_page: 1, last_page: 1, per_page: 20, total: rows.length, counts: { open: rows.length, contacted: 0, converted: 0, dismissed: 0 }, sources: { store: 0, cart: rows.length, landing: 0 } } });
    });
  }

  function page() {
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <SessionProvider value={{ user: { id: 1, name: "م", role: "owner", permissions: ["*"] }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>
            <AbandonedPage />
          </SessionProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );
  }

  const a = ar.orders.abandoned;
  const sent = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/leads/recovery/remind")).map(([, init]) => JSON.parse(String((init as RequestInit).body)));

  it("sends to everyone on the tab, or to the picked carts only", { timeout: 20000 }, async () => {
    // One waiting on its order's payment: marked, and can't be picked.
    route([lead(1), lead(2), lead(3, { order: { id: 9, number: 1009 } })]);
    page();
    expect(await screen.findByText("عميل 1", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(a.waitingPayment)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: a.pickOne("عميل 3") })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: a.remindAll }));
    fireEvent.click(await screen.findByRole("button", { name: a.remindSend }, { timeout: 5000 }));
    await waitFor(() => expect(sent()).toEqual([{ source: "cart" }]), { timeout: 5000 });
    // The dialog closes once the send is accepted.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 });

    fireEvent.click(screen.getByRole("checkbox", { name: a.pickOne("عميل 2") }));
    fireEvent.click(screen.getByRole("button", { name: a.remindPicked(1) }));
    fireEvent.click(await screen.findByRole("button", { name: a.remindSend }, { timeout: 5000 }));
    await waitFor(() => expect(sent()[1]).toEqual({ ids: [2] }), { timeout: 5000 });
  });
});
