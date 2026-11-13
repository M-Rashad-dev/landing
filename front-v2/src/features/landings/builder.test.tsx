import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import type { Content } from "@/themes/bidaya/types";
import { LandingBuilder } from "./builder";


vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/landings/5/builder", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/auth/session-context", () => ({ useSession: () => ({ storeUrl: "https://naanaa.com", store_name: "نعناع" }) }));

const t = ar.landings.builder;
const tb = ar.design.builder;
const fields = { name: { enabled: true, required: true }, phone: { enabled: true, required: true }, phone2: { enabled: false, required: false }, email: { enabled: false, required: false }, governorate: { enabled: true, required: true }, city: { enabled: false, required: false }, address: { enabled: true, required: true }, notes: { enabled: false, required: false } };
const content: Content = {
  version: 1,
  settings: {
    colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" },
    font: "cairo",
    font_size: "medium",
    button: "rounded",
    logo_media_id: null,
    header: { show: true, announcement: null },
    footer: { text: null, phone: null, whatsapp: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
    general: { sticky_order_button: true, whatsapp_button: false },
  },
  sections: [
    { id: "hero000001", type: "hero", visible: true, props: { title: "ساعتك الذكية", subtitle: null, image_media_id: null, show_price: true, button_label: "اطلب دلوقتي", badge: null } },
    { id: "form000001", type: "order_form", visible: true, props: { title: "فورم الطلب هنا", subtitle: null, button_label: "تأكيد الطلب", fields, offer_picker: false, show_quantity: true } },
  ],
};
const detail = { id: 5, title: "عرض الساعة", slug: "watch", status: "draft", theme_key: "bidaya", identity_id: 1, product_id: 1, has_unpublished_changes: false, published_at: null, draft_content: content, version: 1, seo_override: null };
const preview = {
  page: { id: 5, slug: "watch", title: "عرض الساعة" },
  product: { id: 1, name: "ساعة ذكية", slug: "watch", description: null, short_description: null, price: 850, compare_at_price: null, available: true, stock_mode: "unlimited", stock: null, variant_stock: null, images: [], options: [] },
  offers: [],
  media: {},
  shipping: { enabled: false },
  reviews: [],
  store_name: "نعناع",
};

let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      const path = url.replace(/^\/api\/bff/, "").split("?")[0];
      if (path === "/dashboard/pages/5" && method === "GET") return Response.json({ data: detail });
      if (path === "/dashboard/pages/5/preview") return Response.json({ data: preview });
      if (path === "/dashboard/pages/5/content") return Response.json({ data: { ...detail, draft_content: body.content, version: body.version + 1 } });
      if (path === "/dashboard/pages/5/publish") return Response.json({ data: { ...detail, status: "published", published_at: "2026-11-13T10:00:00Z", version: 3 } });
      return Response.json({ data: [] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("landing Builder", () => {
  it("keeps the order form, adds a section above it, saves the draft and publishes", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <LandingBuilder id={5} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(`${t.types.order_form.title} · ${t.locked}`, {}, { timeout: 5000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: tb.addSection }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(t.types.faq.title) }));
    const ids = () => Array.from(document.querySelectorAll("main [id^=section-]")).map((el) => el.id);
    expect(ids()).toHaveLength(3);
    expect(ids()[2]).toBe("section-form000001");

    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.url.endsWith("/dashboard/pages/5/content"))).toBe(true), { timeout: 3000 });
    const saved = calls.find((c) => c.method === "PUT")!.body as { version: number; content: Content };
    expect(saved.version).toBe(1);
    expect(saved.content.sections.map((s) => s.type)).toEqual(["hero", "faq", "order_form"]);

    await act(async () => {
      await screen.findByText(tb.saved);
    });
    fireEvent.click(screen.getByRole("button", { name: t.publish }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/dashboard/pages/5/publish"))).toBe(true));
  });
});
