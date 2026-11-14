import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { Prose } from "@/features/marketing/prose";
import { platformPageSlug } from "@/lib/host/platform-pages";
import { ar } from "@/messages/ar";
import { countPlaceholders, PlatformPageEditor, PlatformPagesPage } from "./pages-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/admin/pages", useSearchParams: () => new URLSearchParams() }));

const t = ar.admin.pages;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
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

const terms = { slug: "terms", title: "شروط الاستخدام", summary: "ملخص", is_published: true, updated_at: "2026-11-14T10:00:00Z", updated_by: "المدير", body: "## 1. التعريفات\n\nالمنصة مملوكة لـ **[اسم الشركة]** ومقرها [المدينة].\n\n## 2. القبول\n\nنص." };

describe("platform pages helpers", () => {
  it("knows the platform pages and counts the gaps left in [brackets] (not links)", () => {
    expect(platformPageSlug("/terms/")).toBe("terms");
    expect(platformPageSlug("/dashboard")).toBeNull();
    expect(countPlaceholders(terms.body)).toBe(2);
    expect(countPlaceholders("[رابط](https://example.com) بس")).toBe(0);
  });

  it("renders the Markdown with section ids and never raw HTML", () => {
    const { container } = render(<Prose body={"## أول\n\nنص <script>alert(1)</script>\n\n### فرعي\n\n## تاني"} />);
    expect(container.querySelector("#s1")?.textContent).toBe("أول");
    expect(container.querySelector("#s2")?.textContent).toBe("تاني");
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("PlatformPagesPage", () => {
  it("lists the pages with their state and links to edit and view", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [terms, { ...terms, slug: "privacy", title: "سياسة الخصوصية", is_published: false }] }));
    wrap(<PlatformPagesPage siteUrl="https://maksab.test" />);
    expect(await screen.findByText("شروط الاستخدام")).toBeInTheDocument();
    expect(screen.getByText(t.hidden)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: t.edit })[1]).toHaveAttribute("href", "/admin/pages/privacy");
    expect(screen.getAllByRole("link", { name: t.view })).toHaveLength(1);
    expect(screen.getByRole("link", { name: t.view })).toHaveAttribute("href", "https://maksab.test/terms");
  });
});

describe("PlatformPageEditor", () => {
  it("shows the gaps to fill and saves the page", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init?.method === "PUT" ? Response.json({ data: { ...terms, ...JSON.parse(String(init.body)) } }) : Response.json({ data: terms })));
    wrap(<PlatformPageEditor slug="terms" siteUrl="https://maksab.test" />);
    const title = await screen.findByLabelText(new RegExp(t.pageTitle));
    expect(screen.getByText(t.placeholders(2))).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "الشروط والأحكام" } });
    fireEvent.click(screen.getByRole("switch", { name: new RegExp(t.show) }));
    fireEvent.click(await screen.findByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT")!;
    expect(String(put[0])).toContain("/admin/platform-pages/terms");
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ title: "الشروط والأحكام", summary: "ملخص", body: terms.body, is_published: false });
  });

  it("stops a text that is too short", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: terms }));
    wrap(<PlatformPageEditor slug="terms" siteUrl="https://maksab.test" />);
    const body = await screen.findByRole("textbox", { name: new RegExp(t.body) });
    fireEvent.change(body, { target: { value: "قصير" } });
    fireEvent.click(await screen.findByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.bodyRequired)).toBeInTheDocument();
  });
});
