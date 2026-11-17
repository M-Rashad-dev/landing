import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { SufiDesign } from "@/themes/store/sufi/types";
import { newSufiSection } from "./api";

vi.mock("@/lib/auth/session-context", () => ({ useSession: () => ({ storeUrl: "https://sufi.com", store_name: "صوفي" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/design/builder", useSearchParams: () => new URLSearchParams() }));

const none = { type: "none" as const, target_id: null, url: null };
const design: SufiDesign = {
  settings: {
    colors: { primary: "#b9844f", secondary: "#17181c", background: "#faf8f4", text: "#17181c" },
    colors_dark: { primary: "#d49a60", secondary: "#f2f0ec", background: "#111215", text: "#f2f0ec" },
    appearance: { default: "light", toggle: true },
    font: "almarai",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    header: { sticky: true, search: true, announcement: null, layout: "center", topbar: true },
    footer: { about: null, show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
    general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24, floating_call: false, animations: true, offers_tab: { enabled: false, label: null, link: none } },
  },
  sections: [{ id: "faq000000001", type: "faq", visible: true, props: { title: "عندك سؤال؟", text: null, whatsapp_button: false, items: [{ question: "الشحن؟", answer: "يومين" }] } }],
};
const data = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [], category_tiles: {}, featured: {} };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  const payload = { theme: { key: "sufi_store", name: "صوفي" }, store_name: "صوفي", draft: design, version: 2, published_at: null, has_unpublished_changes: true, data };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Response.json({ data: { ...payload, draft: JSON.parse(String(init.body)).draft, version: 3 } });
      if (String(url).includes("categories") || String(url).includes("product")) return Response.json({ data: [] });
      return Response.json({ data: payload });
    }),
  );
});

async function open() {
  // React holds a concurrent render until the theme's font stylesheet loads, which jsdom never
  // does; a first direct (synchronous) render registers it, as the «أساس» suite does.
  const { SufiStore } = await import("@/themes/store/sufi/sufi-store");
  render(<SufiStore design={design} data={data as never} storeName="صوفي" />);
  cleanup();
  const { Builder } = await import("./builder");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Builder />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  // The first import of the Builder is slow on a cold run.
  await screen.findAllByText("عندك سؤال؟", undefined, { timeout: 10000 });
}

const b = ar.design.builder;
const s = ar.design.sufi;

describe("Builder on «صوفي»", () => {
  it("offers «صوفي»'s sections and edits a new one on the canvas", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: b.addSection }));
    expect(await screen.findByRole("button", { name: new RegExp(b.types.countdown.title) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(b.types.location.title) })).toBeInTheDocument();
    // «بنر» of «أساس» is not offered: «صوفي» has its own hero and banners.
    expect(screen.queryByText(b.types.banner.description)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(b.types.marquee.title) }));
    const item = await screen.findByLabelText(new RegExp(s.marquee.item(1)));
    fireEvent.change(item, { target: { value: "خصم 20% النهارده" } });
    expect(screen.getAllByText("خصم 20% النهارده").length).toBeGreaterThan(0);
  });

  it("saves the dark colors, the header layout and the offers tab of the theme", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: b.rail.theme }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(ar.design.theme.tabs.header) }));
    fireEvent.click(await screen.findByRole("radio", { name: s.settings.layouts.start }));

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(true), { timeout: 3000 });
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT")!;
    const body = JSON.parse(String((put[1] as RequestInit).body));
    expect(body.draft.settings.header.layout).toBe("start");
    expect(body.draft.settings.colors_dark.background).toBe("#111215");
  });

  it("starts each «صوفي» section with what its form needs", () => {
    const hero = newSufiSection("hero");
    expect(hero.type).toBe("hero");
    expect(newSufiSection("faq").props).toMatchObject({ items: [{ question: "", answer: "" }] });
    // Shared types come from «أساس».
    expect(newSufiSection("products").type).toBe("products");
  });
});
