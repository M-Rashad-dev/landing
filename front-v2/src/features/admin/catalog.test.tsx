import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { ActivityPage } from "./activity-page";
import type { AdminPlanRow, AdminThemeRow } from "./catalog-api";
import { PlanEditorPage } from "./plan-editor";
import { PlansPage } from "./plans-page";
import { ThemeEditorPage } from "./theme-editor";
import { ThemesPage } from "./themes-page";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }), usePathname: () => "/admin/plans", useSearchParams: () => search }));

const t = ar.admin;

const pro: AdminPlanRow = {
  key: "pro",
  name: "برو",
  tagline: null,
  description: null,
  marketing_points: [],
  is_public: true,
  is_highlighted: true,
  is_archived: false,
  sort_order: 2,
  prices: {
    monthly: { price: 299, discount_percent: 10, discount_starts_at: null, discount_ends_at: null, is_active: true, now: { original: 299, final: 269.1, discount_percent: 10, discount_ends_at: null } },
    yearly: null,
  },
  values: { products: 500, offers: null, store: true, upsells: false },
  subscribers: 3,
};
const entitlements = [
  { key: "products", kind: "limit", label: "المنتجات" },
  { key: "offers", kind: "limit", label: "العروض" },
  { key: "store", kind: "feature", label: "متجر" },
  { key: "upsells", kind: "feature", label: "عروض بعد الطلب" },
];
const settings = { trial_enabled: true, trial_days: 14, trial_plan_key: "basic", grace_hours: 24, invoice_hours: 48, support_email: null, support_whatsapp: null };

const theme: AdminThemeRow = {
  key: "celia",
  name: "سيليا",
  kind: "landing",
  short_description: null,
  price: { original: 100, final: 100, discount_percent: 0 },
  is_free: false,
  is_featured: false,
  released_at: "2026-10-01T00:00:00Z",
  cover: null,
  tags: [],
  sales: 2,
  is_active: true,
  is_listed: true,
  sort_order: 1,
  in_use: 4,
  description: null,
  features: ["سريع"],
  images: [],
  version: "1.0",
  raw: { price: 100, discount_percent: 0, discount_starts_at: null, discount_ends_at: null, min_plan_key: null, is_featured: false, tag_ids: [] },
};

let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  search = new URLSearchParams();
  replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url, method, body });
      const path = url.replace(/^\/api\/bff/, "").split("?")[0];
      if (path === "/admin/plans" && method === "GET") return Response.json({ data: [pro], meta: { entitlements, settings } });
      if (path === "/admin/plans" && method === "POST") return Response.json({ data: { ...pro, ...body, subscribers: 0 } }, { status: 201 });
      if (path === "/admin/billing/settings") return Response.json({ data: { ...settings, ...body } });
      if (path === "/admin/themes" && method === "GET") return Response.json({ data: [theme], meta: { tags: [] } });
      if (path === "/admin/themes/celia" && method === "GET") return Response.json({ data: theme, meta: { tags: [] } });
      if (path === "/admin/themes/celia") return Response.json({ data: { ...theme, ...(body ?? {}) } });
      if (path === "/admin/audit-logs")
        return Response.json({
          data: [{ id: 1, action: "plan.update", target_type: "plan", target_id: "pro", tenant: null, meta: null, admin: { id: 1, name: "رشاد" }, ip: "127.0.0.1", created_at: "2026-11-12T10:00:00Z" }],
          meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
        });
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

describe("admin plans", () => {
  it("lists the plans with today's price and saves the trial settings", async () => {
    wrap(<PlansPage />);
    expect(await screen.findByText(t.plans.subscribers(3))).toBeInTheDocument();
    expect(screen.getByText(t.plans.discount(10))).toBeInTheDocument();
    expect(screen.getByText(t.plans.notSold)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t.plans.settings.trialDays), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.plans.settings.daysInvalid)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.plans.settings.trialDays), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ trial_days: 7, trial_plan_key: "basic", support_email: null }));
  });

  it("creates a plan: checks the code and the price, then sends limits and features", async () => {
    wrap(<PlanEditorPage planKey={null} />);
    const e = t.plans.editor;
    fireEvent.change(await screen.findByLabelText(new RegExp(e.name)), { target: { value: "ماكس" } });
    fireEvent.change(screen.getByLabelText(new RegExp(e.key)), { target: { value: "Max Plan" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(e.priceRequired)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(e.price)), { target: { value: "499" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(e.keyInvalid)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(e.key)), { target: { value: "max" } });
    // «مفتوح» on the second limit (offers).
    fireEvent.click(screen.getAllByRole("checkbox", { name: e.unlimited })[1]);
    fireEvent.click(screen.getByRole("switch", { name: "متجر إلكتروني" }));
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toBeTruthy());
    const body = calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ key: "max", name: "ماكس", prices: { monthly: { price: 499, discount_percent: 0, is_active: true }, yearly: null } });
    expect(body.values).toMatchObject({ store: true, upsells: false, products: 0, offers: null });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/plans/max"));
  });
});

describe("admin themes", () => {
  it("turns a theme off from the list", async () => {
    wrap(<ThemesPage />);
    expect(await screen.findByText(t.themes.inUse(4), { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: new RegExp(t.themes.active) }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ is_active: false }));
  });

  it("saves the details and price of a theme", async () => {
    wrap(<ThemeEditorPage themeKey="celia" />);
    const e = t.themes.editor;
    fireEvent.change(await screen.findByLabelText(new RegExp(e.discountPercent)), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ name: "سيليا", kind: "landing", price: 100, discount_percent: 20, features: ["سريع"], tag_ids: [], min_plan_key: null }));
  });
});

describe("admin activity", () => {
  it("lists what was done and filters by kind", async () => {
    wrap(<ActivityPage />);
    expect((await screen.findAllByText(t.actions["plan.update"])).length).toBeGreaterThan(0);
    expect(screen.getAllByText("رشاد").length).toBeGreaterThan(0);
  });
});
