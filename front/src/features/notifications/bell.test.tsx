import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { BellItem } from "./api";
import { NotificationBell } from "./bell";
import { OPEN_SUPPORT_EVENT } from "./events";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

const t = ar.notifications.bell;

let items: BellItem[];
let calls: Array<{ path: string; method: string }>;

const item = (id: number, over: Partial<BellItem> = {}): BellItem => ({
  id,
  event: "new_order",
  title: `طلب جديد #${1000 + id}`,
  body: "سارة طلبت بإجمالي 450 ج.م.",
  link: `/dashboard/orders/${id}`,
  read: false,
  created_at: "2026-11-15T10:00:00Z",
  ...over,
});

beforeEach(() => {
  push.mockReset();
  calls = [];
  items = [item(3), item(2, { event: "support_reply", title: "رد جديد من الدعم", link: "/dashboard?support=1042" }), item(1, { read: true })];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input).replace(/^\/api\/bff/, "").split("?")[0];
      const method = init?.method ?? "GET";
      calls.push({ path, method });
      if (path === "/dashboard/notifications") return Response.json({ data: { items, has_more: false, unread: items.filter((n) => !n.read).length } });
      if (method === "POST") return new Response(null, { status: 204 });
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
        <NotificationBell area="dashboard" userId={5} />
      </TooltipProvider>
    </QueryClientProvider>,
  );

describe("NotificationBell", () => {
  it("shows the unread count and the list, and opens a notification", async () => {
    wrap();
    const trigger = await screen.findByRole("button", { name: `${t.open} (2)` });
    expect(trigger).toHaveTextContent("2");

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("طلب جديد #1003"));

    expect(push).toHaveBeenCalledWith("/dashboard/orders/3");
    await waitFor(() => expect(calls).toContainEqual({ path: "/dashboard/notifications/3/read", method: "POST" }));
    expect(await screen.findByRole("button", { name: `${t.open} (1)` })).toBeInTheDocument();
  });

  it("opens the support conversation from a support reply", async () => {
    const opened = vi.fn();
    window.addEventListener(OPEN_SUPPORT_EVENT, (e) => opened((e as CustomEvent<number>).detail));
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: `${t.open} (2)` }));
    fireEvent.click(await screen.findByText("رد جديد من الدعم"));

    expect(opened).toHaveBeenCalledWith(1042);
    expect(push).not.toHaveBeenCalled();
  });

  it("marks everything read", async () => {
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: `${t.open} (2)` }));
    fireEvent.click(await screen.findByRole("button", { name: t.markAll }));

    await waitFor(() => expect(calls).toContainEqual({ path: "/dashboard/notifications/read", method: "POST" }));
    expect(await screen.findByRole("button", { name: t.open })).toBeInTheDocument();
  });

  it("says when there is nothing yet", async () => {
    items = [];
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: t.open }));
    expect(await screen.findByText(t.empty)).toBeInTheDocument();
  });
});
