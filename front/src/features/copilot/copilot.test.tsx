import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { CopilotChat as ChatPayload, CopilotMessage } from "./api";
import { CopilotChat } from "./copilot-chat";
import { CopilotButton } from "./copilot-drawer";
import { CopilotProvider, useCopilotContext } from "./copilot-provider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/orders", useSearchParams: () => new URLSearchParams() }));

const t = ar.copilot;

let enabled: boolean;
let chat: ChatPayload;
let sent: { url: string; body: unknown }[];
let sendResponse: () => Response;

function message(over: Partial<CopilotMessage>): CopilotMessage {
  return { id: 1, role: "assistant", text: null, media: [], blocks: [], status: "done", progress: null, error: null, error_code: null, created_at: new Date().toISOString(), ...over };
}

beforeEach(() => {
  enabled = true;
  sent = [];
  chat = { chat: { id: 7, title: null, closed: false, created_at: null }, messages: [], has_more: false };
  sendResponse = () => Response.json({ data: message({ id: 11, status: "pending", progress: "بفكّر…" }) }, { status: 202 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^\/api\/bff/, "");
      if (url.startsWith("/dashboard/ai/copilot/status")) return Response.json({ data: { enabled } });
      if (url.startsWith("/dashboard/ai/copilot/chats/7/messages")) {
        sent.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
        return sendResponse();
      }
      if (url.startsWith("/dashboard/ai/copilot/chat")) return Response.json({ data: chat });
      return Response.json({ data: null });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Context({ children }: { children: React.ReactNode }) {
  useCopilotContext({ entity: { type: "products", id: 12 } });
  return <>{children}</>;
}

function show(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <CopilotProvider>
          <Context>{node}</Context>
        </CopilotProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("copilot chat", () => {
  it("says it is off when the copilot is disabled, and hides the top-bar button", async () => {
    enabled = false;
    show(
      <>
        <CopilotButton />
        <CopilotChat userId={1} />
      </>,
    );
    expect(await screen.findByText(t.disabledTitle)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.buttonHint })).toBeNull();
  });

  it("shows examples in an empty chat and fills the box with one", async () => {
    show(<CopilotChat userId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: t.examples[0] }));
    expect((screen.getByPlaceholderText(t.placeholder) as HTMLTextAreaElement).value).toBe(t.examples[0]);
  });

  it("sends the text with the page context and shows the pending reply", async () => {
    show(<CopilotChat userId={1} />);
    const box = await screen.findByPlaceholderText(t.placeholder);
    chat = { ...chat, messages: [message({ id: 10, role: "user", text: "إزاي أعمل كوبون؟" }), message({ id: 11, status: "pending", progress: "بدوّر في الشرح…" })] };
    fireEvent.change(box, { target: { value: "إزاي أعمل كوبون؟" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({ text: "إزاي أعمل كوبون؟", media_ids: [], context: { page: "/dashboard/orders", entity: { type: "products", id: 12 } } });
    expect(await screen.findByText("بدوّر في الشرح…")).toBeTruthy();
  });

  it("draws a reply with its text and a button to the designer", async () => {
    chat = {
      ...chat,
      messages: [
        message({ id: 1, role: "user", text: "صمملي بنر" }),
        message({ id: 2, text: "**تمام**، افتح المصمم من الزرار.", blocks: [{ type: "handoff", target: "designer", label: "افتح المصمم الذكي", href: "/dashboard/design/builder?ai=1&prompt=x" }, { type: "something_new" }] }),
      ],
    };
    show(<CopilotChat userId={1} />);
    expect(await screen.findByText("تمام")).toBeTruthy();
    const link = screen.getByRole("link", { name: /افتح المصمم الذكي/ });
    expect(link.getAttribute("href")).toBe("/dashboard/design/builder?ai=1&prompt=x");
  });

  it("never renders raw HTML from a reply", async () => {
    chat = { ...chat, messages: [message({ id: 2, text: "<img src=x onerror=alert(1)> أهلاً" })] };
    const { container } = show(<CopilotChat userId={1} />);
    await screen.findByText(/أهلاً/);
    expect(container.querySelector("img")).toBeNull();
  });

  it("offers a top-up when the balance is low", async () => {
    sendResponse = () => Response.json({ message: "رصيد الذكاء الاصطناعي مش كفاية.", code: "ai_balance_low" }, { status: 422 });
    show(<CopilotChat userId={1} />);
    const box = await screen.findByPlaceholderText(t.placeholder);
    fireEvent.change(box, { target: { value: "سؤال" } });
    fireEvent.click(screen.getByRole("button", { name: t.send }));
    expect(await screen.findByText("رصيد الذكاء الاصطناعي مش كفاية.")).toBeTruthy();
    expect(screen.getByRole("link", { name: t.topUp }).getAttribute("href")).toBe("/dashboard/settings/ai");
  });

  it("shows a failed reply with a retry", async () => {
    chat = { ...chat, messages: [message({ id: 1, role: "user", text: "سؤال" }), message({ id: 2, status: "failed", error: "المساعد مش متاح دلوقتي، جرّب بعد شوية." })] };
    show(<CopilotChat userId={1} />);
    expect(await screen.findByText("المساعد مش متاح دلوقتي، جرّب بعد شوية.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect((sent[0]?.body as { text: string }).text).toBe("سؤال");
  });
});
