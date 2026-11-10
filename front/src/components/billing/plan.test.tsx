import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/components/dashboard/session-context";
import { api } from "@/lib/api/client";
import { announcePlanBlock, isErrorToastMuted } from "@/lib/billing/events";
import type { Entitlements } from "@/lib/billing/types";
import type { Session } from "@/lib/types";
import { ar } from "@/messages/ar";
import { isClosed, PlanBanner, PlanGate, UpgradeDialog } from "./plan";

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    state: "active",
    plan: { key: "basic", name: "بيسك" },
    period: "monthly",
    is_trial: false,
    ends_at: "2026-12-10T10:00:00Z",
    grace_ends_at: "2026-12-11T10:00:00Z",
    days_left: 30,
    renewal_due: false,
    features: { upsells: false, abandoned_leads: false, advanced_analytics: false, remove_branding: false, buy_themes: false },
    limits: {
      products: { limit: 5, unlimited: false },
      landing_pages: { limit: 3, unlimited: false },
      custom_domains: { limit: 0, unlimited: false },
      media_storage_mb: { limit: 200, unlimited: false },
      offers: { limit: 2, unlimited: false },
      discount_codes: { limit: 2, unlimited: false },
      webhooks: { limit: 0, unlimited: false },
      ab_tests: { limit: 0, unlimited: false },
    },
    ...overrides,
  };
}

function withPlan(plan: Entitlements | null, node: React.ReactNode) {
  const session: Session = {
    user: { id: 1, name: "رشاد", email: "r@example.com", phone: "+201000000000", role: "owner", last_login_at: null },
    tenant: { id: 1, name: "متجر", status: "active", created_at: null },
    primary_host: null,
    plan,
    public_origin: { scheme: "https", port: "" },
  };
  return render(<SessionProvider session={session}>{node}</SessionProvider>);
}

describe("isClosed", () => {
  it("is closed for an off feature or a zero limit, open otherwise", () => {
    const plan = entitlements();
    expect(isClosed(plan, { feature: "upsells" })).toBe(true);
    expect(isClosed(plan, { limit: "webhooks" })).toBe(true);
    expect(isClosed(plan, { limit: "products" })).toBe(false);
    expect(isClosed({ ...plan, features: { ...plan.features, upsells: true } }, { feature: "upsells" })).toBe(false);
  });

  it("is closed for everything on an expired plan and never for the admin (no plan)", () => {
    expect(isClosed(entitlements({ state: "expired" }), { limit: "products" })).toBe(true);
    expect(isClosed(null, { feature: "upsells" })).toBe(false);
  });
});

describe("PlanBanner", () => {
  it("shows the trial days left", () => {
    withPlan(entitlements({ is_trial: true, days_left: 4 }), <PlanBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(ar.billing.banner.trial(4));
  });

  it("warns before renewal and when expired", () => {
    const { unmount } = withPlan(entitlements({ renewal_due: true, days_left: 3 }), <PlanBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(ar.billing.banner.renewal(3));
    unmount();

    withPlan(entitlements({ state: "expired" }), <PlanBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(ar.billing.banner.expired);
  });

  it("stays hidden on a running plan far from its end", () => {
    withPlan(entitlements(), <PlanBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("PlanGate", () => {
  it("shows the notice above the screen, or instead of it with replace", () => {
    const { unmount } = withPlan(entitlements(), <PlanGate feature="upsells" label="عروض">
      <p>content</p>
    </PlanGate>);
    expect(screen.getByText(ar.billing.locked.featureTitle("عروض"))).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
    unmount();

    withPlan(entitlements(), <PlanGate feature="advanced_analytics" label="تحليلات" replace>
      <p>content</p>
    </PlanGate>);
    expect(screen.queryByText("content")).toBeNull();
  });
});

describe("plan refusals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the upgrade dialog with the plan to move to and mutes the error toast", () => {
    withPlan(entitlements(), <UpgradeDialog />);

    act(() => announcePlanBlock({ code: "plan_limit_reached", message: "وصلت للحد", limit_key: "products", limit: 5, used: 5, upgrade_to: { key: "pro", name: "برو" } }));

    expect(screen.getByText(ar.billing.dialog.limitTitle)).toBeInTheDocument();
    expect(screen.getByText(ar.billing.dialog.upgradeTo("برو"))).toBeInTheDocument();
    expect(isErrorToastMuted()).toBe(true);

    fireEvent.click(screen.getByText(ar.billing.dialog.later));
    expect(screen.queryByText(ar.billing.dialog.limitTitle)).toBeNull();
  });

  it("announces a 403 plan code from the API client", async () => {
    const seen = vi.fn();
    window.addEventListener("plan:blocked", seen);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code: "plan_feature_locked", message: "x", feature: "upsells" }), { status: 403 }))));

    await expect(api("/dashboard/upsells", { method: "POST", body: {} })).rejects.toMatchObject({ status: 403, code: "plan_feature_locked" });
    expect(seen).toHaveBeenCalledOnce();
    window.removeEventListener("plan:blocked", seen);
  });

  it("does not announce other 403s", async () => {
    const seen = vi.fn();
    window.addEventListener("plan:blocked", seen);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code: "forbidden", message: "x" }), { status: 403 }))));

    await expect(api("/dashboard/x")).rejects.toMatchObject({ status: 403 });
    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener("plan:blocked", seen);
  });
});
