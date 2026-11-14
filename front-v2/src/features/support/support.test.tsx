import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { checkFiles } from "./api";

const params = { value: new URLSearchParams() };
const replace = vi.fn((href: string) => {
  params.value = new URLSearchParams(href.split("?")[1] ?? "");
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: replace, replace, refresh: vi.fn() }), usePathname: () => "/dashboard/orders", useSearchParams: () => params.value }));

const { SupportWidget } = await import("./support-widget");
const { SupportPage } = await import("../admin/support-page");
const t = ar.support;

/** XHR used by uploads (fetch has no progress). */
class FakeXhr {
  static last: FakeXhr | null = null;
  static respond: (url: string) => unknown = () => ({});
  url = "";
  body: FormData | null = null;
  status = 201;
  responseText = "";
  upload = { onprogress: null as null | ((e: ProgressEvent) => void) };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  open(_m: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {}
  send(body: FormData) {
    this.body = body;
    FakeXhr.last = this;
    this.responseText = JSON.stringify({ data: FakeXhr.respond(this.url) });
    queueMicrotask(() => this.onload?.());
  }
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  params.value = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

const ticket = {
  number: 1001, topic: "orders", status: "waiting_merchant", close_reason: null, store: { id: 3, name: "متجر النور" }, created_at: "2026-11-14T08:00:00Z", last_message_at: "2026-11-14T08:10:00Z",
  closed_at: null, closes_at: "2026-11-14T20:10:00Z", merchant_read_at: "2026-11-14T08:00:00Z", support_read_at: "2026-11-14T08:05:00Z", unread_merchant: true, unread_support: false,
  rating: null, rating_resolved: null, rating_comment: null, reopened_count: 0, last_message: { sender: "support", preview: "بنشوفها", files: 0 },
};
const messages = [
  { id: 1, sender: "merchant", body: "الطلب مش ظاهر", created_at: "2026-11-14T08:00:00Z", attachments: [{ id: 9, kind: "image", name: "screen.png", mime: "image/png", size: 1000 }] },
  { id: 2, sender: "support", body: "بنشوفها حالًا", created_at: "2026-11-14T08:10:00Z", attachments: [] },
];

describe("files in the chat", () => {
  it("opens an image full screen in the page, and keeps a video as a file until it's opened", async () => {
    const { Thread } = await import("./chat");
    const withVideo = [{ ...messages[0], attachments: [messages[0].attachments[0], { id: 10, kind: "video", name: "bug.mp4", mime: "video/mp4", size: 5 * 1024 * 1024 }] }];
    const { container } = wrap(<Thread side="merchant" conversation={{ ticket, messages: withVideo, has_more: false } as never} />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText(`${t.media.video} · ${t.media.mb(5)}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.media.open("screen.png") }));
    const viewer = await screen.findByRole("dialog", { name: /screen\.png/ });
    expect(within(viewer).getByRole("img", { name: "screen.png" })).toHaveAttribute("src", "/api/bff/dashboard/support/attachments/9");
    expect(within(viewer).getByRole("link", { name: t.media.download })).toHaveAttribute("download", "screen.png");

    // The next file is the video, playing only now.
    fireEvent.click(within(viewer).getByRole("button", { name: t.media.next }));
    expect(within(viewer).getByLabelText("bug.mp4").tagName).toBe("VIDEO");
    fireEvent.click(within(viewer).getByRole("button", { name: t.media.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("files", () => {
  it("takes images up to 10 MB and videos up to 50 MB only", () => {
    const file = (name: string, type: string, mb: number) => Object.defineProperty(new File(["x"], name, { type }), "size", { value: mb * 1024 * 1024 });
    expect(checkFiles([file("a.png", "image/png", 9), file("b.mp4", "video/mp4", 49)])).toEqual([]);
    expect(checkFiles([file("c.png", "image/png", 11)])[0].problem).toBe("size");
    expect(checkFiles([file("d.pdf", "application/pdf", 1)])[0].problem).toBe("type");
  });
});

describe("SupportWidget (the store)", () => {
  it("opens from the corner bubble with the unread count, and blocks a new conversation with the reason", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/summary")) return Response.json({ data: { unread: 1, open: 2, can_open: false, reason: "عندك 2 محادثات مفتوحة" } });
      return Response.json({ data: [ticket] });
    });
    wrap(<SupportWidget tenantId={3} />);
    const bubble = screen.getByRole("button", { name: t.bubble });
    expect(await within(bubble).findByText("1")).toBeInTheDocument();
    fireEvent.click(bubble);

    const dialog = screen.getByRole("dialog", { name: t.name });
    expect(await within(dialog).findByText("#1001")).toBeInTheDocument();
    expect(within(dialog).getByText(t.status.waiting_merchant)).toBeInTheDocument();
    expect(within(dialog).getByText("عندك 2 محادثات مفتوحة")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: new RegExp(t.list.new) })).toBeDisabled();
  });

  it("starts a conversation with a topic, the page it came from, and the message", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/summary")) return Response.json({ data: { unread: 0, open: 0, can_open: true, reason: null } });
      return Response.json({ data: [] });
    });
    FakeXhr.respond = () => ({ ticket: { ...ticket, status: "waiting_support", unread_merchant: false }, messages: [messages[0]], has_more: false });
    wrap(<SupportWidget tenantId={3} />);
    fireEvent.click(screen.getByRole("button", { name: t.bubble }));
    const start = await screen.findByRole("button", { name: new RegExp(t.list.new) });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    fireEvent.click(screen.getByRole("radio", { name: t.topics.billing }));
    fireEvent.change(screen.getByRole("textbox", { name: t.compose.message }), { target: { value: "اشتراكي خلص" } });
    fireEvent.click(screen.getByRole("button", { name: t.compose.send }));

    await waitFor(() => expect(FakeXhr.last?.url).toBe("/api/bff/dashboard/support/tickets"));
    const body = FakeXhr.last!.body!;
    expect(body.get("topic")).toBe("billing");
    expect(body.get("body")).toBe("اشتراكي خلص");
    expect(body.get("page")).toBe("/dashboard/orders");
    expect(await screen.findByText("الطلب مش ظاهر")).toBeInTheDocument();
  });

  it("shows the chat as «الدعم», marks it read, and rates a closed conversation", async () => {
    let conversation: { ticket: Record<string, unknown>; messages: typeof messages; has_more: boolean } = { ticket, messages, has_more: false };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/summary")) return Response.json({ data: { unread: 1, open: 1, can_open: false, reason: null } });
      if (u.endsWith("/read")) return Response.json({ data: { ...ticket, unread_merchant: false } });
      if (u.endsWith("/rating")) return Response.json({ data: { ...conversation.ticket, rating: JSON.parse(String(init?.body)).rating } });
      if (u.includes("/tickets/1001")) return Response.json({ data: conversation });
      return Response.json({ data: [ticket] });
    });
    const view = wrap(<SupportWidget tenantId={3} />);
    fireEvent.click(screen.getByRole("button", { name: t.bubble }));
    fireEvent.click(await screen.findByText("#1001"));

    expect(await screen.findByText("بنشوفها حالًا")).toBeInTheDocument();
    expect(screen.getAllByText(t.name).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "screen.png" })).toHaveAttribute("src", "/api/bff/dashboard/support/attachments/9");
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/1001/read"))).toBe(true));

    // Closed by support: the rating replaces the composer.
    conversation = { ticket: { ...ticket, status: "closed", close_reason: "support", closes_at: null, unread_merchant: false }, messages, has_more: false };
    view.unmount();
    wrap(<SupportWidget tenantId={3} />);
    fireEvent.click(screen.getByRole("button", { name: t.bubble }));
    fireEvent.click(await screen.findByText("#1001"));
    fireEvent.click(await screen.findByRole("radio", { name: t.rating.stars(4) }));
    fireEvent.click(screen.getByRole("button", { name: t.rating.yes }));
    fireEvent.click(screen.getByRole("button", { name: t.rating.send }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/1001/rating"))).toBe(true));
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/1001/rating"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ rating: 4, resolved: true, comment: null });
  });
});

describe("SupportPage (the admin)", () => {
  it("lists conversations by tab with the store, opens one with its context and replies", async () => {
    params.value = new URLSearchParams("ticket=1001");
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/admin/support/tickets/1001")) return Response.json({ data: { ticket: { ...ticket, status: "waiting_support", unread_support: false, context: { page: "/dashboard/orders", agent: "Chrome" }, plan: "pro" }, messages, has_more: false, history: [] } });
      return Response.json({ data: [{ ...ticket, status: "waiting_support", unread_support: true }], meta: { current_page: 1, last_page: 1, per_page: 30, total: 1, counts: { waiting_support: 1, waiting_merchant: 0, closed: 0, all: 1 } } });
    });
    FakeXhr.respond = () => ({ id: 3, sender: "support", body: "اتحلت", created_at: "2026-11-14T08:20:00Z", attachments: [] });
    wrap(<SupportPage />);

    expect((await screen.findAllByText("متجر النور")).length).toBeGreaterThan(0);
    expect(await screen.findByText("الطلب مش ظاهر")).toBeInTheDocument();
    expect(screen.getByText(t.admin.tabs.waiting_support, { selector: "button" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: t.compose.message }), { target: { value: "اتحلت" } });
    fireEvent.click(screen.getByRole("button", { name: t.compose.send }));
    await waitFor(() => expect(FakeXhr.last?.url).toBe("/api/bff/admin/support/tickets/1001/messages"));
    expect(FakeXhr.last!.body!.get("body")).toBe("اتحلت");
  });
});
