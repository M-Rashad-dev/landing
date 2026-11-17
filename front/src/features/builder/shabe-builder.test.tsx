import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { ShabeStoreDesign } from "@/themes/store/shabe/types";
import { newShabeStoreSection } from "./api";

vi.mock("@/lib/auth/session-context", () => ({ useSession: () => ({ storeUrl: "https://shabe.com", store_name: "شابع" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/design/builder", useSearchParams: () => new URLSearchParams() }));

const all = { type: "all_products" as const, target_id: null, url: null };
const design: ShabeStoreDesign = {
  settings: {
    colors: { primary: "#e4572e", secondary: "#f2b33d", background: "#fffaf2", text: "#1b120c", dark: "#17110d" },
    font: "cairo",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    display_font: true,
    button: "pill",
    header: { sticky: true, search: true, announcement: null, layout: "start", countdown_ends_at: null, hotline: null, button_label: "اطلب دلوقتي", button_link: all, categories_menu: true },
    footer: { about: null, show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, dark: true, payments: true },
    general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: true },
  },
  sections: [{ id: "faq000000001", type: "faq", visible: true, props: { title: "عندك سؤال؟", text: null, whatsapp_button: false, items: [{ question: "التوصيل؟", answer: "ساعة" }] } }],
};
const data = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [], category_tiles: {}, bundles: {} };
const TYPES = ["food_hero", "marquee", "categories", "product_tabs", "bundles", "products", "why", "steps", "countdown", "video", "gallery", "testimonials", "hours", "faq", "location"];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  const payload = { theme: { key: "shabe_store", name: "شابع", section_types: TYPES, max_sections: 30, settings_groups: ["look", "header", "footer", "general"] }, store_name: "شابع", draft: design, version: 2, published_at: null, has_unpublished_changes: true, data };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Response.json({ data: { ...payload, draft: JSON.parse(String(init.body)).draft, version: 3 } });
      if (String(url).includes("offers")) return Response.json({ data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 20 } });
      if (String(url).includes("categories") || String(url).includes("product")) return Response.json({ data: [] });
      return Response.json({ data: payload });
    }),
  );
});

async function open() {
  // A first direct render registers the theme's font stylesheets (see the «صوفي» suite).
  const { ShabeStore } = await import("@/themes/store/shabe/shabe-store");
  render(<ShabeStore design={design} data={data as never} storeName="شابع" />);
  cleanup();
  const { Builder } = await import("./builder");
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <Builder />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await screen.findAllByText("عندك سؤال؟", undefined, { timeout: 10000 });
}

const b = ar.design.builder;
const s = ar.design.shabeStore;

describe("Builder on «شابع · متجر»", () => {
  it("offers the food sections and adds «مواعيد العمل» with its days", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: b.addSection }));
    expect(await screen.findByRole("button", { name: new RegExp(b.types.bundles.title) })).toBeInTheDocument();
    // «صوفي»'s brands are not «شابع»'s.
    expect(screen.queryByText(b.types.brands.description)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(b.types.hours.title) }));
    expect(await screen.findByRole("switch", { name: new RegExp(s.hours.days[6]) })).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(s.hours.openMessage))).toBeInTheDocument();
  });

  it("saves «شابع»'s own settings with the base ones (dark color, hotline)", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: b.rail.theme }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(ar.design.theme.tabs.header) }));
    fireEvent.click(await screen.findByRole("radio", { name: s.settings.layouts.center }));

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(true), { timeout: 3000 });
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT")!;
    const body = JSON.parse(String((put[1] as RequestInit).body));
    expect(body.draft.settings.header.layout).toBe("center");
    expect(body.draft.settings.colors.dark).toBe("#17110d");
  });

  it("starts each new food section with what its form needs", () => {
    expect(newShabeStoreSection("hours").props).toMatchObject({ days: expect.arrayContaining([{ open: true, from: "12:00", to: "23:00" }]) });
    expect((newShabeStoreSection("hours").props as { days: unknown[] }).days).toHaveLength(7);
    expect(newShabeStoreSection("why").props).toMatchObject({ items: [{ icon: "chef" }, { icon: "leaf" }] });
    // Library types come from the library.
    expect(newShabeStoreSection("faq").type).toBe("faq");
  });
});
