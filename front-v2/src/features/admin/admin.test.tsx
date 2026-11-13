import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { AdminOverview, AlertSettings, StoreBilling, StoreDetail } from "./api";
import { AdminHome } from "./home-page";
import { AdminSettingsPage } from "./settings-page";
import { StorePage } from "./store-page";
import { StoresPage } from "./stores-page";

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), usePathname: () => "/admin/stores", useSearchParams: () => search }));

const t = ar.admin;

const overview: AdminOverview = {
  stores: { total: 12, active: 11, suspended: 1, new_week: 2, new_month: 4 },
  subscriptions: { trials: 3, paying: 6, gifted: 1, expiring_week: 2, expired: 2, plans: [{ key: "pro", name: "برو", total: 6 }] },
  billing: { revenue_month: 1500, revenue_previous: 1000, pending_payments: 2, refund_requests: 0 },
  activity: { orders_today: 5, orders_month: 40, orders_previous: 20, sales_month: 24000, sales_previous: 12000 },
  days: [{ date: "2026-11-12", stores: 1, orders: 5, sales: 1000 }],
  top_stores: [{ id: 7, name: "متجر سما", orders: 9, sales: 5400 }],
};

const store: StoreDetail = {
  id: 7,
  name: "متجر سما",
  status: "active",
  owner: { id: 3, name: "سما", email: "sama@example.com", phone: "+201012345678", last_login_at: "2026-11-12T10:00:00Z" },
  subdomain: "sama.localtest.me",
  primary_host: "sama.localtest.me",
  store_url: "http://sama.localtest.me:3000/",
  orders_count: 9,
  products_count: 14,
  customers_count: 8,
  sales: 5400,
  last_order_at: "2026-11-12T09:00:00Z",
  plan_key: "pro",
  plan_name: "برو",
  plan_state: "active",
  plan_is_trial: false,
  plan_ends_at: "2026-12-01T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
  suspended_at: null,
  suspended_reason: null,
  domains: [{ id: 1, host: "sama.localtest.me", type: "subdomain", status: "active", is_primary: true }],
};

const billing: StoreBilling = {
  state: "active",
  plan: { key: "pro", name: "برو" },
  period: "monthly",
  is_trial: false,
  trial_used: true,
  ends_at: "2026-12-01T00:00:00Z",
  grace_ends_at: "2026-12-02T00:00:00Z",
  features: { store: true },
  subscriptions: [{ id: 1, plan_key: "pro", plan_name: "برو", period: "monthly", source: "payment", status: "active", starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", amount_paid: 100, note: null }],
  overrides: [],
  usage: [{ key: "products", label: "products", used: 14, limit: 100, unlimited: false }],
};

let alerts: AlertSettings;
let calls: Array<{ url: string; method: string; body: unknown }> = [];

beforeEach(() => {
  calls = [];
  search = new URLSearchParams();
  push.mockReset();
  replace.mockReset();
  alerts = { email: null, events: ["receipt_submitted", "daily_summary"], available: ["receipt_submitted", "refund_requested", "store_registered", "daily_summary"], mail_ready: false };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      const path = url.replace(/^\/api\/bff/, "").split("?")[0];
      if (path === "/admin/overview") return Response.json({ data: overview });
      if (path === "/admin/plans") return Response.json({ data: [{ key: "pro", name: "برو", is_archived: false }] });
      if (path === "/admin/tenants") return Response.json({ data: [store], meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 } });
      if (path === "/admin/tenants/7") return Response.json({ data: store });
      if (path === "/admin/tenants/7/billing") return Response.json({ data: billing });
      if (path === "/admin/tenants/7/themes") return Response.json({ data: [] });
      if (path === "/admin/audit-logs") return Response.json({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
      if (path === "/admin/tenants/7/suspend") return Response.json({ data: { ...store, status: "suspended", suspended_reason: body.reason } });
      if (path === "/admin/tenants/7/reset-password") return Response.json({ data: { temporary_password: "Xy7#pQ2!mN4z" } });
      if (path === "/admin/alerts" && method === "PUT") {
        alerts = { ...alerts, email: body.email, events: body.events };
        return Response.json({ data: alerts });
      }
      if (path === "/admin/alerts") return Response.json({ data: alerts });
      if (path === "/admin/alerts/test") return Response.json({ data: { sent_to: alerts.email, mail_ready: false } });
      return Response.json({ message: "not found" }, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );

describe("admin home", () => {
  it("shows what waits, the month against last month, and the top stores", async () => {
    wrap(<AdminHome />);
    expect(await screen.findByText(t.attention.payments(2))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(t.attention.expiring(2)) })).toHaveAttribute("href", "/admin/stores?tab=expiring");
    expect(screen.getByText(formatMoney(24000))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /متجر سما/ })).toHaveAttribute("href", "/admin/stores/7");
    expect(screen.getByRole("link", { name: new RegExp(t.home.subscriptions.trials) })).toHaveAttribute("href", "/admin/stores?tab=trial");
  });
});

describe("admin stores", () => {
  it("lists the stores and filters by tab", async () => {
    wrap(<StoresPage />);
    expect((await screen.findAllByText("sama.localtest.me")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatMoney(5400)).length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByRole("tab", { name: t.stores.tabs.expiring }));
    fireEvent.click(screen.getByRole("tab", { name: t.stores.tabs.expiring }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls.at(-1)?.[0])).toContain("tab=expiring");
  });

  it("suspends a store with a reason, and shows a temporary password once", async () => {
    wrap(<StorePage id={7} />);
    expect(await screen.findByRole("heading", { name: /متجر سما/ })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: t.store.actions }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: t.store.suspend.action }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: t.store.suspend.confirm }));
    expect(await within(dialog).findByText(t.store.suspend.reasonRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.store.suspend.reason)), { target: { value: "محتوى مخالف" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.store.suspend.confirm }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/suspend"))?.body).toEqual({ reason: "محتوى مخالف" }));

    fireEvent.keyDown(screen.getByRole("button", { name: t.store.actions }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: t.store.password.action }));
    fireEvent.click(await screen.findByRole("button", { name: t.store.password.confirm }));
    expect(await screen.findByText("Xy7#pQ2!mN4z")).toBeInTheDocument();
  });
});

describe("admin email alerts", () => {
  it("says the provider is not connected, saves the email and the alerts, then sends a test", async () => {
    wrap(<AdminSettingsPage />);
    expect(await screen.findByText(t.settings.alerts.notReadyTitle)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(t.settings.alerts.email)), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.settings.alerts.emailInvalid)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(t.settings.alerts.email)), { target: { value: "owner@platform.test" } });
    fireEvent.click(screen.getByRole("switch", { name: new RegExp(t.settings.alerts.events.store_registered.title) }));
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ email: "owner@platform.test", events: ["receipt_submitted", "daily_summary", "store_registered"] }));

    const test = await screen.findByRole("button", { name: t.settings.alerts.test });
    await waitFor(() => expect(test).toBeEnabled());
    fireEvent.click(test);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/admin/alerts/test"))).toBe(true));
  });
});
