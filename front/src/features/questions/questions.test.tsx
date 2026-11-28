import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { ProductQuestionsSection } from "@/themes/store/asas/pages/questions";
import type { QuestionRow } from "./api";
import { QuestionsPage } from "./questions-page";

/* Stage S3 (docs/plans/tekno/PLAN.md §3): «أسئلة العملاء» in the dashboard and on the product page. */

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/questions",
  useSearchParams: () => search,
}));

const t = ar.questions;
const s = ar.storefront.questions;
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  search = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sentBody = (method: string, path: string) => {
  const call = fetchMock.mock.calls.find(([url, init]) => String(url).includes(path) && (init?.method ?? "GET") === method);
  return call ? JSON.parse(String(call[1]?.body ?? "null")) : undefined;
};

function wrap(ui: React.ReactNode, role: "owner" | "staff" = "owner", permissions: string[] = ["*"]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "م", role, permissions }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>{ui}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const row = (id: number, extra: Partial<QuestionRow> = {}): QuestionRow => ({
  id,
  name: "سارة محمود",
  phone: "+201012345678",
  question: "هل بتشتغل مع آيفون؟",
  answer: null,
  answered_at: null,
  is_published: false,
  status: "unanswered",
  created_at: "2026-11-28T10:00:00Z",
  product: { id: 7, name: "سماعة بلوتوث", slug: "buds", image: null, deleted: false },
  ...extra,
});

function serve(rows: QuestionRow[], enabled = true) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const path = String(url).replace("/api/bff", "").split("?")[0];
    const method = init?.method ?? "GET";
    if (method === "GET" && path === "/dashboard/questions") {
      return Promise.resolve(json({ data: rows, meta: { current_page: 1, last_page: 1, per_page: 20, total: rows.length, counts: { all: rows.length, unanswered: 1, published: 0, hidden: 0 }, enabled } }));
    }
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      return Promise.resolve(json({ data: { ...rows[0], ...body, status: body.is_published ? "published" : "hidden" } }));
    }
    if (method === "PUT") return Promise.resolve(json({ data: { enabled: JSON.parse(String(init?.body)).enabled } }));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
}

describe("«أسئلة العملاء» in the dashboard", () => {
  it("lists the questions with the asker's phone, answers one and publishes it", async () => {
    serve([row(1)]);
    wrap(<QuestionsPage />);

    expect((await screen.findAllByText("هل بتشتغل مع آيفون؟")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.status.unanswered).length).toBeGreaterThan(0);
    expect(screen.getAllByText("سماعة بلوتوث").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${t.answer}$`) })[0]);
    const dialog = await screen.findByRole("dialog");
    // Empty answers are refused before anything is sent.
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    expect(await screen.findByText(t.answerRequired)).toBeInTheDocument();
    expect(sentBody("PATCH", "/dashboard/questions/1")).toBeUndefined();

    await userEvent.type(screen.getByLabelText(new RegExp(t.answerLabel)), "أيوه، بتشتغل مع أي موبايل.");
    // Published by default for a new answer.
    expect(screen.getByRole("switch", { name: new RegExp(t.publishLabel) })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    await waitFor(() => expect(sentBody("PATCH", "/dashboard/questions/1")).toEqual({ answer: "أيوه، بتشتغل مع أي موبايل.", is_published: true }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("hides a published answer, deletes, and turns questions off for the store", async () => {
    serve([row(2, { answer: "سنة.", answered_at: "2026-11-28T11:00:00Z", is_published: true, status: "published" })]);
    wrap(<QuestionsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: new RegExp(t.hide) }))[0]);
    await waitFor(() => expect(sentBody("PATCH", "/dashboard/questions/2")).toEqual({ is_published: false }));

    fireEvent.click(screen.getByRole("switch", { name: new RegExp(t.enabled) }));
    await waitFor(() => expect(sentBody("PUT", "/dashboard/questions/settings")).toEqual({ enabled: false }));

    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`${t.remove}:`) })[0]);
    fireEvent.click(await screen.findByRole("button", { name: t.remove }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("/dashboard/questions/2") && init?.method === "DELETE")).toBe(true));
  });

  it("shows staff who may only read no answer, hide or delete buttons, and explains an empty list", async () => {
    serve([row(3)]);
    wrap(<QuestionsPage />, "staff", ["questions.view"]);
    expect((await screen.findAllByText("هل بتشتغل مع آيفون؟")).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: new RegExp(`^${t.answer}$`) })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: new RegExp(`${t.remove}:`) })).toHaveLength(0);
    expect(screen.getByRole("switch", { name: new RegExp(t.enabled) })).toBeDisabled();
    cleanup();

    serve([]);
    wrap(<QuestionsPage />);
    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument();
  });
});

describe("«أسئلة العملاء» on the product page", () => {
  const published = { count: 1, items: [{ id: 1, name: "سارة م.", question: "الضمان كام سنة؟", answer: "سنتين ضمان الوكيل.", answered_at: "2026-11-28T11:00:00Z" }] };

  it("shows the published answers, and nothing when the store turned questions off", () => {
    const { container, rerender } = render(<ProductQuestionsSection slug="buds" questions={published} />);
    expect(screen.getByRole("heading", { name: new RegExp(s.title) })).toHaveTextContent(s.count(1));
    expect(screen.getByText("الضمان كام سنة؟")).toBeInTheDocument();
    expect(screen.getByText("سنتين ضمان الوكيل.")).toBeInTheDocument();
    expect(screen.getByText(s.asked("سارة م."))).toBeInTheDocument();

    rerender(<ProductQuestionsSection slug="buds" questions={{ count: 0, items: [] }} />);
    expect(screen.getByText(s.empty)).toBeInTheDocument();

    rerender(<ProductQuestionsSection slug="buds" questions={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("checks the form, sends the question with the store's token, and says it arrived", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("form-token")) return Promise.resolve(json({ data: { token: "1700000000.abc" } }));
      return Promise.resolve(new Response(null, { status: 202 }));
    });
    render(<ProductQuestionsSection slug="buds" questions={{ count: 0, items: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(s.ask) }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/public/store/form-token", expect.anything()));

    fireEvent.click(screen.getByRole("button", { name: s.send }));
    expect(await screen.findByText(s.errors.name)).toBeInTheDocument();
    expect(screen.getByText(s.errors.question)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(s.name), "أحمد علي");
    await userEvent.type(screen.getByLabelText(new RegExp(s.phone)), "123");
    await userEvent.type(screen.getByLabelText(s.question), "فيه لون أبيض؟");
    fireEvent.click(screen.getByRole("button", { name: s.send }));
    expect(await screen.findByText(s.errors.phone)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(new RegExp(s.phone)));
    await userEvent.type(screen.getByLabelText(new RegExp(s.phone)), "01012345678");
    fireEvent.click(screen.getByRole("button", { name: s.send }));
    // The token is waited out to 3 seconds old before sending.
    expect(await screen.findByText(s.sent, undefined, { timeout: 6000 })).toBeInTheDocument();
    expect(sentBody("POST", "/api/public/store/questions")).toEqual({ slug: "buds", name: "أحمد علي", phone: "01012345678", question: "فيه لون أبيض؟", form_token: "1700000000.abc", website: "" });
  }, 15000);

  it("shows the store's own message when it refuses", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("form-token")) return Promise.resolve(json({ data: { token: "1700000000.abc" } }));
      return Promise.resolve(json({ message: "بعت أسئلة كتير الساعة دي. جرّب تاني بعد شوية.", code: "too_many_questions" }, 429));
    });
    render(<ProductQuestionsSection slug="buds" questions={{ count: 0, items: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(s.ask) }));
    await userEvent.type(screen.getByLabelText(s.name), "أحمد");
    await userEvent.type(screen.getByLabelText(s.question), "فيه لون أبيض؟");
    fireEvent.click(screen.getByRole("button", { name: s.send }));
    expect(await screen.findByRole("alert", undefined, { timeout: 6000 })).toHaveTextContent("بعت أسئلة كتير");
  }, 15000);
});
