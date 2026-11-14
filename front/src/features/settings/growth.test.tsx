import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { saveUpsell } from "@/lib/store/upsell";
import { ar } from "@/messages/ar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/settings/pixels", useSearchParams: () => new URLSearchParams() }));

const { PixelsPage } = await import("./pixels-page");
const { IntegrationsPage } = await import("./integrations-page");
const { UpsellsPage } = await import("@/features/promotions/upsells/upsells-page");
const { AbTestsPage } = await import("@/features/landings/ab-tests-page");
const { UpsellOffer } = await import("@/themes/upsell-offer");

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode, features: Record<string, boolean> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { name: "محمد" }, tenant: { name: "نعناع" }, plan: { features, limits: {} }, store_name: "نعناع", storeUrl: "https://naanaa.mksab.com" } as never}>{ui}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const sent = (path: string, method: string) => fetchMock.mock.calls.find(([url, init]) => String(url).includes(path) && (init as RequestInit | undefined)?.method === method);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit).body));

describe("PixelsPage", () => {
  const settings = { store: { meta_pixel_id: "1234567890" }, landing: { conversion_event: "Purchase" }, landing_same: true };

  it("uses the store pixels on landing pages until the merchant turns that off", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => (init?.method === "PUT" ? Response.json({ data: JSON.parse(String(init.body)) }) : Response.json({ data: settings })));
    wrap(<PixelsPage />);
    expect(await screen.findByDisplayValue("1234567890")).toBeInTheDocument();
    expect(document.getElementById("landing-meta_pixel_id")).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: new RegExp(ar.growth.pixels.same) }));
    const landingMeta = (await waitFor(() => document.getElementById("landing-meta_pixel_id"))) as HTMLInputElement;
    await userEvent.type(landingMeta, "9999999999");
    await userEvent.click(screen.getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(sent("/dashboard/pixels", "PUT")).toBeTruthy());
    const body = bodyOf(sent("/dashboard/pixels", "PUT"));
    expect(body.landing_same).toBe(false);
    expect(body.landing).toMatchObject({ meta_pixel_id: "9999999999", conversion_event: "Purchase" });
    expect(body.store.meta_pixel_id).toBe("1234567890");
  });

  it("stops a malformed id before it is sent", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: settings }));
    wrap(<PixelsPage />);
    const meta = await screen.findByDisplayValue("1234567890");
    await userEvent.clear(meta);
    await userEvent.type(meta, "<script>");
    await userEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(ar.growth.pixels.invalid)).toBeInTheDocument();
    expect(sent("/dashboard/pixels", "PUT")).toBeUndefined();
  });
});

describe("IntegrationsPage", () => {
  const hook = { id: 3, locked_by_plan: false, kind: "webhook", name: "سيستمي", url: "https://example.com/hook", secret: "whsec_abc", events: ["order.created"], is_active: true, failures_count: 2, last_status: "failed", last_delivery_at: null };

  it("lists each connection with its state and sends a test", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/test")) return Response.json({ data: { delivery: { id: 1, status: "success", response_code: 200 } } });
      void init;
      return Response.json({ data: [hook], meta: { events: ["order.created", "order.status_changed"] } });
    });
    wrap(<IntegrationsPage />);
    expect(await screen.findByText("سيستمي")).toBeInTheDocument();
    expect(screen.getByText(ar.growth.integrations.failures(2))).toBeInTheDocument();
    expect(screen.getByText("whsec_abc")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: ar.growth.integrations.test }));
    await waitFor(() => expect(sent("/dashboard/integrations/3/test", "POST")).toBeTruthy());
  });

  it("adds a Google Sheet with the guide and the chosen events", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? Response.json({ data: { id: 9 } }, { status: 201 }) : Response.json({ data: [], meta: { events: ["order.created", "order.status_changed", "lead.created"] } })));
    wrap(<IntegrationsPage />);
    await userEvent.click((await screen.findAllByRole("button", { name: ar.growth.integrations.add }))[0]);
    expect(await screen.findByText(ar.growth.integrations.steps.title)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(new RegExp(ar.growth.integrations.urlSheets)), "https://script.google.com/macros/s/x/exec");
    await userEvent.click(screen.getByRole("checkbox", { name: ar.growth.integrations.eventNames["lead.created"] }));
    await userEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(sent("/dashboard/integrations", "POST")).toBeTruthy());
    expect(bodyOf(sent("/dashboard/integrations", "POST"))).toEqual({ kind: "google_sheets", name: "Google Sheets", url: "https://script.google.com/macros/s/x/exec", events: ["order.created", "order.status_changed", "lead.created"] });
  });
});

describe("UpsellsPage", () => {
  const upsell = { id: 4, name: "حزام مع الساعة", trigger_product: { id: 1, name: "ساعة" }, offer_product: { id: 2, name: "حزام", price: 150 }, price: 99, headline: "ضيف حزام", description: null, is_active: true, priority: 0, accepted_count: 3, accepted_revenue: 297 };

  it("shows each offer with how often it was taken", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [upsell] }));
    wrap(<UpsellsPage />);
    expect(await screen.findByText("حزام مع الساعة")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ar.growth.upsells.accepted(3)))).toBeInTheDocument();
  });

  it("locks the page when the plan has no upsells", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }));
    wrap(<UpsellsPage />, { upsells: false });
    expect(await screen.findByText(ar.growth.upsells.locked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ar.growth.upsells.add })).toBeNull();
  });
});

describe("AbTestsPage", () => {
  const side = (views: number, orders: number) => ({ views, form_starts: 0, orders, revenue: orders * 100, conversion: (orders / views) * 100 });
  const test = {
    id: 1, locked_by_plan: false, name: "عنوان جديد", status: "running", split_a: 50,
    page_a: { id: 10, title: "الأصلية", slug: "offer", published: true }, page_b: { id: 11, title: "النسخة", slug: "offer-2", published: true },
    winner_page_id: null, started_at: "2026-11-01T10:00:00Z", ended_at: null,
    results: { a: side(400, 8), b: side(400, 20), verdict: { state: "winner", leader: "b", confidence: 98, lift: 150 } },
  };

  it("shows both pages, the verdict, and finishes with B as the winner", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? Response.json({ data: { ...test, status: "finished" } }) : Response.json({ data: [test] })));
    wrap(<AbTestsPage />);
    expect(await screen.findByText(ar.growth.ab.verdict.winner("النسخة", 98))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: ar.growth.ab.finish }));
    await userEvent.click(await screen.findByRole("button", { name: ar.growth.ab.keepB }));
    await waitFor(() => expect(sent("/dashboard/ab-tests/1/finish", "POST")).toBeTruthy());
    expect(bodyOf(sent("/dashboard/ab-tests/1/finish", "POST"))).toEqual({ winner_page_id: 11 });
  });
});

describe("UpsellOffer (thank-you screen)", () => {
  const offer = { id: 4, token: "t".repeat(64), headline: "ضيف حزام بـ 99 بس", description: null, product: { name: "حزام", image: null }, price: 99, regular_price: 150 };

  it("adds the offer to this order in one click and shows the new total", async () => {
    saveUpsell(1001, offer);
    fetchMock.mockResolvedValue(Response.json({ data: { order_number: 1001, total: 1599 } }));
    const onTotal = vi.fn();
    render(<UpsellOffer orderNumber={1001} onTotal={onTotal} />);
    expect(await screen.findByText("ضيف حزام بـ 99 بس")).toBeInTheDocument();
    expect(screen.getByText(ar.growth.offer.off(34))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: ar.growth.offer.add }));
    expect(await screen.findByRole("status")).toHaveTextContent(ar.growth.offer.added);
    expect(onTotal).toHaveBeenCalledWith(1599);
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ order_number: 1001, upsell_id: 4, token: "t".repeat(64) });
    expect(window.sessionStorage.getItem("lp_upsell")).toBeNull();
  });

  it("shows nothing for another order, and goes away on «no thanks»", async () => {
    saveUpsell(1001, offer);
    const { unmount } = render(<UpsellOffer orderNumber={1002} />);
    expect(screen.queryByText("ضيف حزام بـ 99 بس")).toBeNull();
    unmount();
    render(<UpsellOffer orderNumber={1001} />);
    await userEvent.click(await screen.findByRole("button", { name: ar.growth.offer.skip }));
    expect(screen.queryByText("ضيف حزام بـ 99 بس")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
