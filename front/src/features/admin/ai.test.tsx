import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { AiOverview } from "./ai-api";
import { AiPage } from "./ai-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/ai", useSearchParams: () => new URLSearchParams() }));

const t = ar.admin.ai;
let overview: AiOverview;
let sent: unknown = null;

beforeEach(() => {
  sent = null;
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
});
