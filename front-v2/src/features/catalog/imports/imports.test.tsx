import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";

const params = { value: new URLSearchParams() };
const replace = vi.fn((href: string) => {
  params.value = new URLSearchParams(href.split("?")[1] ?? "");
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: replace, replace, refresh: vi.fn() }), usePathname: () => "/dashboard/catalog/products/import", useSearchParams: () => params.value }));

const { ImportPage } = await import("./import-page");
const t = ar.imports;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  replace.mockClear();
  params.value = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <ImportPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const base = { source: "generic", file_name: "منتجات.xlsx", total_rows: 3, total_products: 0, processed: 0, created: 0, updated: 0, skipped: 0, failed: 0, images: { total: 0, done: 0, failed: 0 }, warnings: [], error: null, options: {}, created_at: "2026-11-14T08:00:00Z", started_at: null, finished_at: null };

describe("ImportPage", () => {
  it("starts on the upload with the template and the platforms it understands", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }));
    wrap();
    expect(screen.getByText(t.upload.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(t.upload.templateDownload) })).toHaveAttribute("href", "/api/bff/dashboard/product-imports/template");
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(await screen.findByText(t.history.empty)).toBeInTheDocument();
  });

  it("shows the guessed columns with samples and starts the import with the chosen options", async () => {
    params.value = new URLSearchParams("id=7");
    const preview = { ...base, id: 7, status: "uploaded", source: "shopify", headers: ["Title", "Variant Price", "Variant SKU", "Notes"], samples: [["Hoodie", "450", "HD-1", "x"]], mapping: { name: 0, price: 1, sku: 2 }, fields: [], multi: ["images"], room: 2 };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/start")) return Response.json({ data: { ...preview, status: "queued" } });
      if (String(url).includes("/product-imports/7")) return Response.json({ data: preview });
      return Response.json({ data: [preview] });
    });
    wrap();

    expect(await screen.findByText(t.detected("Shopify"))).toBeInTheDocument();
    expect(screen.getByText(t.mapping.room(2, 3))).toBeInTheDocument();
    expect(screen.getByText(t.mapping.unused(1))).toBeInTheDocument();
    expect(screen.getByText("Hoodie", { selector: "span" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: new RegExp(t.options.visible) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.mapping.start) }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/start"))).toBe(true));
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/start"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ mapping: { name: 0, price: 1, sku: 2 }, options: { match: "sku", existing: "update", visible: false } });
  });

  it("follows a finished import: counters, notes, and every failed product with its reason", async () => {
    params.value = new URLSearchParams("id=9");
    const done = { ...base, id: 9, status: "completed", total_products: 3, processed: 3, created: 2, failed: 1, started_at: "2026-11-14T08:00:00Z", finished_at: "2026-11-14T08:00:20Z", warnings: ["ملاحظة مهمة"], images: { total: 4, done: 4, failed: 0 } };
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/failures")) return Response.json({ data: [{ id: 1, row_number: 4, identifier: "SH-1", name: "جزمة", reasons: ["الـ SKU «SH-1» متكرر في الملف (أول مرة في صف 2)"] }], meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 } });
      if (String(url).includes("/product-imports/9")) return Response.json({ data: done });
      return Response.json({ data: [done] });
    });
    wrap();

    expect(await screen.findByRole("status")).toHaveTextContent(t.run.completed);
    expect(screen.getByText(t.run.progress(3, 3))).toBeInTheDocument();
    expect(screen.getByText("ملاحظة مهمة")).toBeInTheDocument();
    expect(screen.getByText(t.run.imagesProgress(4, 4, 0))).toBeInTheDocument();
    expect(await screen.findByText(t.failures.title(1))).toBeInTheDocument();
    expect(screen.getByText("جزمة")).toBeInTheDocument();
    expect(screen.getByText(/متكرر في الملف/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.failures.download })).toHaveAttribute("href", "/api/bff/dashboard/product-imports/9/failures/file");
  });

  it("lets a running import be stopped", async () => {
    params.value = new URLSearchParams("id=5");
    const running = { ...base, id: 5, status: "processing", total_products: 1000, processed: 250, created: 250, started_at: "2026-11-14T08:00:00Z" };
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/cancel")) return Response.json({ data: { ...running, status: "cancelled" } });
      if (String(url).includes("/product-imports/5")) return Response.json({ data: running });
      return Response.json({ data: [running] });
    });
    wrap();

    expect(await screen.findByText(t.run.progress(250, 1000))).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    fireEvent.click(screen.getByRole("button", { name: t.run.cancel }));
    fireEvent.click(await screen.findByRole("button", { name: t.run.cancel, hidden: false }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/cancel"))).toBe(true));
  });
});
