import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { AiOverview } from "./ai-api";
import { AiPage } from "./ai-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/ai", useSearchParams: () => new URLSearchParams() }));

const t = ar.admin.ai;
let overview: AiOverview;
let sent: unknown = null;
let posted: unknown = null;
const articles = [
  { id: 1, title: "إزاي أضيف منتج؟", category: "products", body: "روح المنتجات ← منتج جديد.", is_active: true, pieces: 1, state: "ready", error: null, updated_at: null },
  { id: 2, title: "إزاي أربط دومين؟", category: "domain", body: "من الإعدادات ← الدومين.", is_active: true, pieces: 1, state: "waiting", error: null, updated_at: null },
];

beforeEach(() => {
  sent = null;
  posted = null;
  overview = {
    settings: { features: { support: false }, daily_cap_usd: 20, usd_rate: null, margin_percent: 10, support_daily_messages: 30 },
    status: { configured: false, driver: "qwen", paused_until: null, today_usd: 0.0123, limit_reached: false },
    models: [{ model: "qwen4-max", priced: true }],
    usage: {
      today: { calls: 12, usd: 0.0123, failed: 1 },
      month: { calls: 340, usd: 0.62, failed: 3 },
      by_feature: [{ feature: "support", calls: 340, usd: 0.62 }],
      top_stores: [{ tenant_id: 7, name: "متجر سما", calls: 40, usd: 0.08 }],
      failures: [{ at: "2026-11-18T10:00:00Z", feature: "support", model: "qwen4-max", error: "Qwen 429 Throttling" }],
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input).replace(/^\/api\/bff/, "").split("?")[0];
      if (path === "/admin/ai/articles" && init?.method === "POST") {
        posted = JSON.parse(String(init.body));
        return Response.json({ data: { id: 9, ...(posted as object), pieces: 1, state: "waiting", error: null, updated_at: null } });
      }
      if (path === "/admin/ai/articles") return Response.json({ data: articles });
      if (path === "/admin/ai/settings" && init?.method === "PUT") {
        sent = JSON.parse(String(init.body));
        return Response.json({ data: { ...overview, settings: sent } });
      }
      return Response.json({ data: overview });
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
        <AiPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );

describe("admin AI page", () => {
  it("shows the connection, the cost and the failures", async () => {
    show();
    expect(await screen.findByText(t.notConfigured)).toBeInTheDocument();
    expect(screen.getByText("$0.0123")).toBeInTheDocument();
    expect(screen.getByText("$0.62")).toBeInTheDocument();
    expect(screen.getByText("متجر سما")).toBeInTheDocument();
    expect(screen.getByText("Qwen 429 Throttling")).toBeInTheDocument();
  });

  it("turns the support assistant on and saves the limits", async () => {
    show();
    fireEvent.click(await screen.findByRole("switch", { name: new RegExp(t.featureNames.support) }));
    fireEvent.change(screen.getByLabelText(t.supportMessages, { exact: false }), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(document.body.textContent).not.toContain(t.invalid));
    await waitFor(() => expect(sent).toEqual({ features: { support: true }, daily_cap_usd: 20, usd_rate: null, margin_percent: 10, support_daily_messages: 50 }));
  });

  it("refuses a wrong limit before sending", async () => {
    show();
    fireEvent.change(await screen.findByLabelText(t.dailyCap, { exact: false }), { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.invalid)).toHaveAttribute("id", "ai-cap-error");
    expect(sent).toBeNull();
  });

  it("lists the assistant's articles with their state, filters them, and writes a new one", async () => {
    show();
    const k = t.knowledge;
    expect(await screen.findByText("إزاي أضيف منتج؟")).toBeInTheDocument();
    expect(screen.getByText(k.states.ready)).toBeInTheDocument();
    expect(screen.getByText(k.states.waiting)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(k.search), { target: { value: "دومين" } });
    expect(screen.queryByText("إزاي أضيف منتج؟")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: k.add }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: new RegExp(`^${k.titleLabel}`) }), { target: { value: "إزاي أشحن؟" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: new RegExp(`^${k.body}`) }), { target: { value: "من الشحن ← شركات الشحن." } });
    fireEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(posted).toEqual({ title: "إزاي أشحن؟", category: "start", body: "من الشحن ← شركات الشحن.", is_active: true }));
  });
});
