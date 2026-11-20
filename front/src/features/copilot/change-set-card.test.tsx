import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { ChangeSet } from "./api";
import { ChangeSetCard } from "./change-set-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));

const t = ar.copilot.change;

let set: ChangeSet;
let posted: string[];

function changeSet(over: Partial<ChangeSet>): ChangeSet {
  return {
    id: 5,
    kind: "update",
    target: "products",
    target_label: "المنتجات",
    summary: "السعر: زيادة 30% — 2 من المنتجات",
    status: "proposed",
    keep_draft: false,
    reversible: true,
    items_count: 2,
    applied_count: 0,
    skipped_count: 0,
    failed_count: 0,
    counts: { pending: 2 },
    columns: [{ key: "price", label: "السعر", kind: "money" }],
    items: [
      { id: 1, entity_id: 11, label: "حذاء", url: "/dashboard/catalog/products/11", before: { price: "100.00" }, after: { price: "130.00" }, status: "pending", note: null },
      { id: 2, entity_id: 12, label: "شنطة", url: "/dashboard/catalog/products/12", before: { price: "200.00" }, after: { price: "260.00" }, status: "pending", note: null },
    ],
    has_more_items: false,
    link: "/dashboard/catalog/products",
    error: null,
    can: { accept: true, reject: true, revert: false },
    expires_at: null,
    applied_at: null,
    reverted_at: null,
    created_at: null,
    ...over,
  };
}

beforeEach(() => {
  posted = [];
  set = changeSet({});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^\/api\/bff/, "");
      if (init?.method === "POST") {
        posted.push(url);
        const closed = { accept: false, reject: false, revert: false };
        if (url.endsWith("/revert")) {
          const revert = { ...set, id: 6, kind: "revert", status: "applying" };
          set = { ...set, status: "reverted", can: closed };
          return Response.json({ data: revert }, { status: 202 });
        }
        // The server's state after the click (what a refetch then returns).
        set = { ...set, status: url.endsWith("/accept") ? "applying" : "rejected", can: closed };
        return Response.json({ data: set }, { status: url.endsWith("/reject") ? 200 : 202 });
      }
      return Response.json({ data: set });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ChangeSetCard id={5} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("change set card", () => {
  it("previews before → after and applies only on «نفّذ»", async () => {
    show();
    expect(await screen.findByText(set.summary)).toBeTruthy();
    expect(screen.getByText(t.willChange(2))).toBeTruthy();
    expect(screen.getByRole("link", { name: "حذاء" }).getAttribute("href")).toBe("/dashboard/catalog/products/11");
    expect(screen.getAllByText(/130/).length).toBeGreaterThan(0);
    expect(posted).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: t.apply }));

    await waitFor(() => expect(posted).toEqual(["/dashboard/ai/copilot/change-sets/5/accept"]));
    expect(await screen.findByText(t.status.applying)).toBeTruthy();
  });

  it("lists new drafts and deletes them only after confirming", async () => {
    set = changeSet({ kind: "create", summary: "إضافة 2 من المنتجات كمسودة", columns: [], items: set.items.map((i) => ({ ...i, before: {}, after: {} })) });
    show();
    expect(await screen.findByText(t.drafts(2))).toBeTruthy();
    expect(screen.getByRole("button", { name: t.publish })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t.remove }));
    expect(posted).toEqual([]);
    fireEvent.click(await screen.findByRole("button", { name: t.remove, hidden: false, description: undefined }));
    await waitFor(() => expect(posted).toContain("/dashboard/ai/copilot/change-sets/5/reject"));
  });

  it("offers «سيبهم مسودة» when the merchant asked to keep drafts", async () => {
    set = changeSet({ kind: "create", keep_draft: true, columns: [] });
    show();
    expect(await screen.findByRole("button", { name: t.keepDraft })).toBeTruthy();
  });

  it("offers «تراجع» on an applied change and asks first", async () => {
    set = changeSet({ status: "applied", applied_count: 2, counts: { applied: 2 }, can: { accept: false, reject: false, revert: true } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: t.revert }));
    expect(await screen.findByText(t.revertTitle)).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: t.revert });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(posted).toEqual(["/dashboard/ai/copilot/change-sets/5/revert"]));
  });

  it("shows why a record was skipped", async () => {
    set = changeSet({ counts: { pending: 1, skipped_invalid: 1 }, items: [{ ...changeSet({}).items[0]!, status: "skipped_invalid", note: "السعر قبل الخصم لازم يبقى أكبر من السعر" }] });
    show();
    expect(await screen.findByText("السعر قبل الخصم لازم يبقى أكبر من السعر")).toBeTruthy();
    expect(screen.getByText(t.skipped(1), { exact: false })).toBeTruthy();
  });
});
