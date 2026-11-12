import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { AsasStore } from "@/themes/asas/asas-store";
import { inkOn, type Design, type DesignData } from "@/themes/asas/types";
import { newSection } from "./api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/design/builder", useSearchParams: () => new URLSearchParams() }));

const design: Design = {
  settings: {
    colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" },
    font: "cairo",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    header: { sticky: true, search: true, announcement: "شحن مجاني فوق 1000" },
    footer: { about: "متجر تجربة", show_pages: true, phone: "01012345678", whatsapp: "01012345678", email: null, address: null, social: { facebook: "https://facebook.com/x", instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
    general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24 },
  },
  sections: [
    { id: "banner000001", type: "banner", visible: true, props: { slides: [], autoplay: true } },
    { id: "latest000001", type: "products", visible: true, props: { title: "أحدث المنتجات", description: "وصل جديد", source: "latest", category_id: null, limit: 8, layout: "grid", columns: 4, show_view_all: true } },
    { id: "hidden000001", type: "features", visible: false, props: { title: "مخفي", items: [{ icon: "truck", title: "شحن", text: null }, { icon: "cash", title: "دفع", text: null }] } },
    { id: "reviews00001", type: "testimonials", visible: true, props: { title: "آراء عملائنا", source: "auto", items: [] } },
  ],
};

const data: DesignData = {
  products: { latest000001: [{ id: 1, slug: "watch", name: "ساعة ذكية", short_description: null, price: 850, compare_at_price: 1000, discount_percent: 15, image: null, available: true, needs_options: false }] },
  view_all: { latest000001: "/products" },
  links: {},
  media: {},
  categories: [{ id: 1, parent_id: null, name: "ساعات", slug: "watches" }],
  pages: [{ title: "سياسة الاسترجاع", slug: "returns" }],
  reviews: [{ name: "سارة", rating: 5, text: "ممتاز" }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("«أساس»", () => {
  it("draws the visible sections in order with the store's settings", () => {
    render(<AsasStore design={design} data={data} storeName="نعناع" />);
    expect(screen.getByText("شحن مجاني فوق 1000")).toBeInTheDocument();
    expect(screen.getByText("أحدث المنتجات")).toBeInTheDocument();
    expect(screen.getByText("وصل جديد")).toBeInTheDocument();
    expect(screen.getByText("ساعة ذكية")).toBeInTheDocument();
    expect(screen.getByText(ar.storefront.off(15))).toBeInTheDocument();
    expect(screen.queryByText("مخفي")).toBeNull();
    expect(screen.getByText("ممتاز")).toBeInTheDocument();
    expect(screen.getByText("سياسة الاسترجاع")).toBeInTheDocument();
    expect(screen.getByText(ar.storefront.platform)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ar.storefront.whatsapp })).toHaveAttribute("href", "https://wa.me/201012345678");
    // An empty banner is not shown to customers.
    expect(screen.queryByText(ar.storefront.empty.banner)).toBeNull();
  });

  it("lets the Builder pick a section and keeps links inert", () => {
    const onSelect = vi.fn();
    render(<AsasStore design={design} data={data} storeName="نعناع" mode="builder" selected="latest000001" onSelect={onSelect} />);
    expect(screen.getByText(ar.storefront.empty.banner)).toBeInTheDocument();
    fireEvent.click(screen.getByText("آراء عملائنا"));
    expect(onSelect).toHaveBeenCalledWith("reviews00001");
    fireEvent.click(screen.getByText("شحن مجاني فوق 1000"));
    expect(onSelect).toHaveBeenLastCalledWith("header");
    expect(document.querySelector(".as-selected")?.id).toBe("section-latest000001");
  });

  it("picks readable text on any color and builds new sections ready to edit", () => {
    expect(inkOn("#ffc83d")).toBe("#111111");
    expect(inkOn("#0b875b")).toBe("#ffffff");
    const s = newSection("products");
    expect(s.id).toMatch(/^[0-9a-f]{12}$/);
    expect(s.props).toMatchObject({ source: "latest", limit: 8, layout: "grid" });
  });
});

describe("Builder", () => {
  beforeEach(() => {
    const payload = { theme: { key: "asas", name: "أساس" }, store_name: "نعناع", draft: design, version: 3, published_at: null, has_unpublished_changes: true, data };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") return Response.json({ data: { ...payload, draft: JSON.parse(String(init.body)).draft, version: 4 } });
        if (init?.method === "POST") return Response.json({ data: { ...payload, version: 4, published_at: "2026-11-12T10:00:00Z", has_unpublished_changes: false } });
        return Response.json({ data: payload });
      }),
    );
  });

  it("saves the draft by itself after an edit, with its version", async () => {
    const { Builder } = await import("./builder");
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <Builder />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await screen.findAllByText("أحدث المنتجات");
    fireEvent.click(screen.getByRole("button", { name: ar.design.builder.header }));
    const announcement = await screen.findByLabelText(new RegExp(ar.design.theme.announcement));
    fireEvent.change(announcement, { target: { value: "عرض العيد" } });
    expect(screen.getAllByText("عرض العيد").length).toBeGreaterThan(0);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(true), { timeout: 3000 });
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT")!;
    const body = JSON.parse(String((put[1] as RequestInit).body));
    expect(body.version).toBe(3);
    expect(body.draft.settings.header.announcement).toBe("عرض العيد");
    await act(async () => {
      await screen.findByText(ar.design.builder.saved);
    });
  });
});
