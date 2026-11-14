import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { DashboardDemo } from "./dashboard-demo";
import { DEMO_DAYS, demoPeriod } from "./demo-data";
import { Faq } from "./faq";
import type { PublicPlan } from "./plans";
import { planLines, Pricing } from "./pricing";

const t = ar.marketing;
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const plan = (key: string, values: PublicPlan["values"], monthly: number, yearly: number, highlighted = false): PublicPlan => ({
  key,
  name: key,
  tagline: null,
  is_highlighted: highlighted,
  prices: { monthly: { original: monthly, final: monthly, discount_percent: 0, discount_ends_at: null }, yearly: { original: yearly * 1.2, final: yearly, discount_percent: 17, discount_ends_at: null } },
  values,
});
const basic = plan("basic", { store: false, products: 5, landing_pages: 3, custom_domains: 0, ab_tests: 0, webhooks: 0, upsells: false, abandoned_leads: false, advanced_analytics: false, media_storage_mb: 200, remove_branding: false }, 50, 500);
const max = plan("max", { store: true, products: 200, landing_pages: null, custom_domains: 5, ab_tests: 5, webhooks: 10, upsells: true, abandoned_leads: true, advanced_analytics: true, media_storage_mb: 10000, remove_branding: true }, 150, 1500, true);

describe("sample data", () => {
  it("is the same on every render and compares with the period before", () => {
    expect(DEMO_DAYS).toHaveLength(180);
    const week = demoPeriod(7);
    expect(week.days).toHaveLength(7);
    expect(week.kpis.orders).toBe(week.days.reduce((s, d) => s + d.orders, 0));
    expect(demoPeriod(30).kpis.sales).toBe(demoPeriod(30).kpis.sales);
  });
});

describe("plan lines", () => {
  it("reads each plan's real limits and features", () => {
    const lines = planLines(basic);
    expect(lines[0]).toEqual({ text: t.pricing.lines.noStore, on: true });
    expect(lines.map((l) => l.text)).not.toContain(t.pricing.lines.custom_domains(0));
    expect(lines.find((l) => l.text === t.pricing.lines.upsells)?.on).toBe(false);

    const top = planLines(max).map((l) => l.text);
    expect(top).toContain(t.pricing.lines.landing_pages(null));
    expect(top).toContain(t.pricing.lines.custom_domains(5));
    expect(top).toContain(t.pricing.lines.remove_branding);
  });

  it("switches to the yearly price and sends the chosen plan to sign-up", () => {
    render(<Pricing plans={[basic, max]} registerUrl="https://app.example.com/register" />);
    expect(screen.getByText("50")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.pricing.yearly) }));
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.pricing.start("max") })).toHaveAttribute("href", "https://app.example.com/register?plan=max");
    expect(screen.getByText(t.pricing.popular)).toBeInTheDocument();
  });
});

describe("DashboardDemo", () => {
  it("changes the numbers with the period and opens the orders from «needs you»", () => {
    render(<DashboardDemo />);
    fireEvent.click(screen.getByRole("radio", { name: t.demo.periods["7"] }));
    expect(screen.getAllByText(t.demo.periods["7"]).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: t.demo.start }));
    expect(screen.getByText(t.demo.ordersSub)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: t.demo.confirm })).toHaveLength(3);
  });

  it("confirms an order: it leaves the «new» tab and the queue count drops", () => {
    render(<DashboardDemo initialView="orders" />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.demo.statuses.new) }));
    fireEvent.click(screen.getAllByRole("button", { name: t.demo.confirm })[0]);
    expect(screen.getByRole("status")).toHaveTextContent(t.demo.confirmed(1033));
    expect(screen.getAllByRole("button", { name: t.demo.confirm })).toHaveLength(2);
    expect(screen.getByRole("button", { name: t.demo.queue(2) })).toBeInTheDocument();
  });

  it("lets new orders arrive while the hero is on screen", () => {
    vi.useFakeTimers();
    let seen: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          seen = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    render(<DashboardDemo live />);
    act(() => seen([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => vi.advanceTimersByTime(2700));
    const toast = screen.getByRole("status");
    expect(within(toast).getByText(t.demo.newOrder(1034))).toBeInTheDocument();
    expect(screen.getByText(t.demo.waiting(4))).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("Faq", () => {
  it("opens one answer at a time", () => {
    render(<Faq />);
    const [first, second] = screen.getAllByRole("button");
    expect(first).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");
  });
});
