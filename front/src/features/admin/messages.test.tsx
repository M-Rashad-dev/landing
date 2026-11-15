import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { MessageRow, MessagesOverview } from "./api";
import { MessagesPage } from "./messages-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/messages", useSearchParams: () => new URLSearchParams() }));

const t = ar.admin.messages;

let overview: MessagesOverview;
const rows: MessageRow[] = [
  { id: 2, recipient: "+201012345678", purpose: "customer_code", template: "mksab_code_v1", status: "failed", error: "Not on WhatsApp", error_code: "131026", tenant: { id: 7, name: "متجر سما" }, created_at: "2026-11-15T10:00:00Z", delivered_at: null, read_at: null },
  { id: 1, recipient: "+201099998888", purpose: "auto_reply", template: null, status: "read", error: null, error_code: null, tenant: null, created_at: "2026-11-15T09:00:00Z", delivered_at: "2026-11-15T09:00:02Z", read_at: "2026-11-15T09:01:00Z" },
];
let calls: Array<{ path: string; method: string }> = [];

beforeEach(() => {
  calls = [];
  overview = {
    configured: true,
    phone: { number: "+20 10 91152636", name: "Mksab", name_status: "AVAILABLE_WITHOUT_REVIEW", quality: "GREEN" },
    templates: [
      { name: "mksab_code_v1", category: "AUTHENTICATION", status: "APPROVED", rejected_reason: null },
      { name: "order_received_v1", category: "UTILITY", status: "REJECTED", rejected_reason: "INVALID_FORMAT" },
      { name: "order_shipped_v1", category: "UTILITY", status: "MISSING", rejected_reason: null },
    ],
    error: null,
    today: { total: 3, delivered: 2, read: 1, failed: 1 },
    month: { total: 10, delivered: 8, read: 5, failed: 2 },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input).replace(/^\/api\/bff/, "").split("?")[0];
      const method = init?.method ?? "GET";
      calls.push({ path, method });
      if (path === "/admin/messages/overview") return Response.json({ data: overview });
      if (path === "/admin/messages") return Response.json({ data: rows, meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 } });
      if (path === "/admin/messages/templates") {
        return Response.json({ data: { templates: overview.templates.map((r) => (r.status === "MISSING" ? { ...r, status: "PENDING" } : r)), submitted: ["order_shipped_v1"], errors: {} } });
      }
      return Response.json({ message: "not found" }, { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <MessagesPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );

describe("admin WhatsApp messages", () => {
  it("shows the number, the templates with their status, and the log", async () => {
    wrap();
    expect(await screen.findByText("+20 10 91152636")).toBeInTheDocument();
    expect(screen.getByText(t.qualities.GREEN)).toBeInTheDocument();
    expect(screen.getAllByText("INVALID_FORMAT").length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.templates.status.MISSING).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Not on WhatsApp")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "متجر سما" })[0]).toHaveAttribute("href", "/admin/stores/7");
    expect(screen.getAllByText(t.log.purpose.auto_reply).length).toBeGreaterThan(0);
  });

  it("submits the missing templates", async () => {
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: t.templates.push }));
    await waitFor(() => expect(calls.some((c) => c.path === "/admin/messages/templates" && c.method === "POST")).toBe(true));
    expect(await screen.findAllByText(t.templates.status.PENDING)).not.toHaveLength(0);
  });

  it("explains what to do when WhatsApp is not connected", async () => {
    overview = { ...overview, configured: false, phone: null, templates: [] };
    wrap();
    expect(await screen.findByText(t.notConfigured)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.templates.push })).not.toBeInTheDocument();
  });
});
