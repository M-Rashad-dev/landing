import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import type { DesignData } from "@/themes/store/shared/types";
import { cairoNow, isOpenAt } from "@/themes/store/shared/use-hours";
import { ShabeStore } from "./shabe-store";
import type { ShabeStoreDesign, ShabeStoreSection } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const t = ar.shabeStore;
const none = { type: "none" as const, target_id: null, url: null };
const all = { type: "all_products" as const, target_id: null, url: null };

const settings: ShabeStoreDesign["settings"] = {
  colors: { primary: "#e4572e", secondary: "#f2b33d", background: "#fffaf2", text: "#1b120c", dark: "#17110d" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  display_font: true,
  button: "pill",
  header: { sticky: true, search: true, announcement: "توصيل ببلاش", layout: "start", countdown_ends_at: null, hotline: "19999", button_label: "اطلب دلوقتي", button_link: all, categories_menu: true },
  footer: { about: "مطبخ بيتي", show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, dark: true, payments: true },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: false },
};

const card = { id: 5, slug: "box", name: "بوكس العيلة", short_description: "كفتة وكباب", price: 899, compare_at_price: 1150, discount_percent: 22, image: null, available: true, needs_options: false, max_quantity: null, rating: null };

const offer = { id: 9, name: "بوكسين", type: "bundle" as const, value: null, min_quantity: 1, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 1650, starts_at: null, ends_at: null, status: "active" as const, badge_text: null, priority: 1 };

const sections: ShabeStoreSection[] = [
  { id: "hero00000001", type: "food_hero", visible: true, props: { kicker: "طازة", title: "أكل يشبّعك", highlight: "يشبّعك", subtitle: null, media_id: null, stickers: ["سخن"], badge: "-20%", primary_label: "اطلب", primary_link: all, second_label: null, second_link: none, trust: [] } },
  { id: "tabs00000001", type: "product_tabs", visible: true, props: { title: "المنيو", description: null, limit: 8, tabs: [{ label: "الجديد", source: "latest", category_id: null, product_ids: [] }, { label: "العروض", source: "offers", category_id: null, product_ids: [] }] } },
  { id: "pack00000001", type: "bundles", visible: true, props: { kicker: null, title: "الباقات", subtitle: null, cards: [{ offer_id: 9, media_id: null, title: "بوكس العزومة", subtitle: null, points: ["٤ كيلو"], ribbon: "الأكتر طلبًا", button_label: null }, { offer_id: 3, media_id: null, title: "خلص", subtitle: null, points: [], ribbon: null, button_label: null }] } },
  { id: "hour00000001", type: "hours", visible: true, props: { title: "المواعيد", subtitle: null, days: Array.from({ length: 7 }, () => ({ open: true, from: "00:00", to: "00:00" })), open_message: "المطبخ شغال", closed_message: "مقفولين" } },
];

const data = {
  products: { "tabs00000001:0": [card], "tabs00000001:1": [] },
  view_all: {},
  links: { "hero00000001:primary": "/products", header_button: "/products" },
  media: {},
  categories: [{ id: 1, parent_id: null, name: "مشويات", slug: "grill" }],
  pages: [],
  reviews: [],
  bundles: { pack00000001: [{ offer, product: card, href: "/products/box" }, null] },
} as unknown as DesignData;

const draw = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShabeStore design={{ settings, sections }} data={data} storeName="شابع" mode="preview" />
    </QueryClientProvider>,
  );

afterEach(() => cleanup());

describe("working hours", () => {
  // Saturday first; 18:00 → 02:00 every day but Friday.
  const days = [...Array.from({ length: 6 }, () => ({ open: true, from: "18:00", to: "02:00" })), { open: false, from: "12:00", to: "23:00" }];

  it("counts hours past midnight for the day they started, and a closed day as closed", () => {
    expect(isOpenAt(days, 0, 19 * 60)).toBe(true); // Saturday 7pm
    expect(isOpenAt(days, 1, 60)).toBe(true); // Sunday 1am: Saturday's night
    expect(isOpenAt(days, 1, 3 * 60)).toBe(false); // Sunday 3am
    expect(isOpenAt(days, 6, 20 * 60)).toBe(false); // Friday: closed
    expect(isOpenAt(days, 6, 60)).toBe(true); // Friday 1am: Thursday's night
    expect(isOpenAt(days, 0, 60)).toBe(false); // Saturday 1am: Friday was closed
  });

  it("reads the day and time in Cairo, whatever the visitor's own time zone", () => {
    // 2026-11-21 is a Saturday; 22:30 UTC is 00:30 Sunday in Cairo (UTC+2).
    expect(cairoNow(new Date("2026-11-21T22:30:00Z"))).toEqual({ day: 1, minutes: 30 });
  });
});

describe("«شابع · متجر»", () => {
  it("draws its own header, the menu tabs, the pack cards from their offers and the open status", () => {
    draw();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("توصيل ببلاش")).toBeInTheDocument();
    expect(within(header).getAllByText("19999")[0]).toBeInTheDocument();
    expect(within(header).getAllByText("اطلب دلوقتي")[0]).toBeInTheDocument();
    expect(within(header).getAllByText("مشويات")[0]).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("أكل يشبّعك");
    expect(screen.getByText("بوكس العيلة")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "العروض" }));
    expect(screen.queryByText("بوكس العيلة")).toBeNull();

    // A bundle of 2 for 1,650 instead of 2 × 899; a gone offer says so.
    expect(screen.getByText(t.bundle.instead(1798))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.bundle.pick })).toHaveAttribute("href", "/products/box");
    expect(screen.getByText(t.bundle.gone)).toBeInTheDocument();

    // Open all day every day: the status and the merchant's message.
    expect(screen.getByRole("status")).toHaveTextContent(t.hours.openNow);
    expect(screen.getByRole("status")).toHaveTextContent("المطبخ شغال");
    expect(screen.getByText(t.footer.payments)).toBeInTheDocument();
  });
});
