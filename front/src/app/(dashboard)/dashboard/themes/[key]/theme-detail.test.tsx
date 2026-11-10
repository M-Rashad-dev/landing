import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/components/dashboard/session-context";
import { Providers } from "@/components/providers";
import type { Entitlements } from "@/lib/billing/types";
import type { ThemeRow } from "@/lib/themes/api";
import type { Session } from "@/lib/types";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";
import { ThemeDetail } from "./theme-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }) }));

const t = ar.themeStore;

const celia: ThemeRow = {
  key: "celia",
  name: "سيليا",
  kind: "landing",
  short_description: "جريء",
  price: { original: 100, discount_percent: 20, final: 80, discount_ends_at: null },
  is_free: false,
  is_featured: false,
  is_new: true,
  released_at: "2026-11-01T00:00:00Z",
  cover: null,
  tags: [{ id: 1, slug: "fashion", name: "ملابس" }],
  sales: 3,
  min_plan: null,
  owned: false,
  can_publish: false,
  description: "وصف الثيم",
  features: ["16 قسم جاهز"],
  images: [],
  version: "1.0",
};

function plan(buyThemes: boolean): Entitlements {
  const limit = { limit: 5, unlimited: false };
  return {
    state: "active",
    plan: { key: buyThemes ? "pro" : "basic", name: buyThemes ? "برو" : "بيسك" },
    period: "monthly",
    is_trial: false,
    ends_at: null,
    grace_ends_at: null,
    days_left: 20,
    renewal_due: false,
    features: { upsells: buyThemes, abandoned_leads: buyThemes, advanced_analytics: buyThemes, remove_branding: false, buy_themes: buyThemes },
    limits: { products: limit, landing_pages: limit, custom_domains: limit, media_storage_mb: limit, offers: limit, discount_codes: limit, webhooks: limit, ab_tests: limit },
  };
}

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }));

function renderDetail(entitlements: Entitlements) {
  const session: Session = {
    user: { id: 1, name: "رشاد", email: "r@x.test", phone: "+201000000000", role: "owner", last_login_at: null },
    tenant: { id: 1, name: "متجر", status: "active", created_at: null },
    primary_host: null,
    plan: entitlements,
    public_origin: { scheme: "https", port: "" },
  };
  return render(
    <Providers>
      <SessionProvider session={session}>
        <ThemeDetail themeKey="celia" />
      </SessionProvider>
    </Providers>,
  );
}

describe("ThemeDetail", () => {
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    push.mockReset();
  });

  it("shows the price with its discount, the features and a live preview link", async () => {
    fetchMock.mockImplementation(() => json(celia));
    renderDetail(plan(true));

    expect(await screen.findByRole("heading", { name: "سيليا" })).toBeInTheDocument();
    expect(screen.getByText(formatPrice(80))).toBeInTheDocument();
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText("16 قسم جاهز")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(t.preview) })).toHaveAttribute("href", "/theme-preview/celia");
  });

  it("buys on Pro and opens the invoice", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === "POST" ? json({ id: 42 }, 201) : json(celia)));
    renderDetail(plan(true));

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(t.buyFor(formatPrice(80))) }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/billing/invoices/42"));
  });

  it("asks Basic to upgrade instead of buying", async () => {
    fetchMock.mockImplementation(() => json(celia));
    renderDetail(plan(false));

    expect(await screen.findByRole("link", { name: new RegExp(t.upgradeToBuy) })).toHaveAttribute("href", "/dashboard/plans");
    expect(screen.queryByRole("button", { name: new RegExp(t.buy) })).toBeNull();
  });

  it("offers to use a theme the store owns", async () => {
    fetchMock.mockImplementation(() => json({ ...celia, owned: true, can_publish: true }));
    renderDetail(plan(true));

    expect(await screen.findByRole("link", { name: new RegExp(t.use) })).toHaveAttribute("href", "/dashboard/pages/new?theme=celia");
  });
});
