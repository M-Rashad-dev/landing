import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import type { DesignData } from "../asas/types";
import { SufiStore } from "./sufi-store";
import { embedUrl, mapEmbed, type SufiDesign, type SufiSection } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);

const t = ar.sufi;
const none = { type: "none" as const, target_id: null, url: null };
const settings: SufiDesign["settings"] = {
  colors: { primary: "#b9844f", secondary: "#17181c", background: "#faf8f4", text: "#17181c" },
  colors_dark: { primary: "#d49a60", secondary: "#f2f0ec", background: "#111215", text: "#f2f0ec" },
  appearance: { default: "light", toggle: true },
  font: "almarai",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  header: { sticky: true, search: true, announcement: "شحن مجاني", layout: "center", topbar: true },
  footer: { about: null, show_pages: true, phone: "01001234567", whatsapp: "01001234567", email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
  general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24, floating_call: true, animations: true, offers_tab: { enabled: true, label: "عروض", link: none } },
};
const card = { id: 1, slug: "watch", name: "ساعة كلاسيك", short_description: null, price: 1290, compare_at_price: 1600, discount_percent: 19, image: null, available: true, needs_options: false, rating: null };
const s = <T extends SufiSection["type"]>(type: T, props: Extract<SufiSection, { type: T }>["props"]) => ({ id: `${type}1`, type, visible: true, props }) as SufiSection;
const sections: SufiSection[] = [
  s("hero", { slides: [{ media_id: 1, title: "أناقة تليق", text: null, button_label: "تسوّق", link: none }], autoplay: false, height: "full", merge_header: true, shade: 40, kicker: null }),
  s("marquee", { items: ["دفع عند الاستلام"], speed: "normal" }),
  s("categories", { title: "الأقسام", description: null, category_ids: [], shape: "circle", layout: "grid", columns_desktop: 6, columns_mobile: 3 }),
  s("product_tabs", { title: "اختياراتنا", description: null, limit: 8, tabs: [{ label: "جديد", source: "latest", category_id: null, product_ids: [] }, { label: "عروض", source: "offers", category_id: null, product_ids: [] }] }),
  s("banners", { items: [{ media_id: 1, kicker: null, title: "الشتاء", button_label: null, link: none }] }),
  s("countdown", { media_id: null, kicker: null, title: "الجمعة البيضاء", text: null, button_label: null, link: none, ends_at: "2000-01-01T00:00:00Z", on_end: "ended" }),
  s("featured_product", { product_id: 9, kicker: null }),
  s("products", { title: "وصل حديثًا", description: null, source: "latest", category_id: null, limit: 4, layout: "grid", columns: 4, show_view_all: false }),
  s("video", { url: "https://youtu.be/abc", title: "شوف", text: null, cover_media_id: null }),
  s("brands", { title: "براندات", items: [{ media_id: 1, name: "A", link: none }, { media_id: 1, name: "B", link: none }] }),
  s("story", { kicker: null, title: "قصتنا", text: null, media_id: 1, media2_id: null, stats: [], button_label: null, link: none }),
  s("features", { title: null, items: [{ icon: "truck", title: "شحن سريع", text: null }, { icon: "cash", title: "كاش", text: null }] }),
  s("testimonials", { title: "آراء", source: "manual", items: [{ name: "منة", rating: 5, text: "ممتاز" }] }),
  s("gallery", { title: "معرض", description: null, items: [1, 1, 1].map((m) => ({ media_id: m, label: null, link: none })) }),
  s("faq", { title: "أسئلة", text: null, whatsapp_button: true, items: [{ question: "الشحن؟", answer: "يومين" }] }),
  s("location", { title: "فروعنا", description: null, branches: [{ name: "مدينة نصر", address: "عباس العقاد", hours: null, phone: null, map_url: "https://maps.app.goo.gl/x" }] }),
];
const data = {
  products: { "product_tabs1:0": [card], "product_tabs1:1": [], products1: [card] },
  view_all: {},
  links: {},
  media: {},
  categories: [],
  pages: [],
  reviews: [],
  category_tiles: { categories1: [{ id: 1, name: "رجالي", slug: "men", image: null, products_count: 4 }] },
  featured: { featured_product1: null },
} as unknown as DesignData;

describe("«صوفي»", () => {
  it("draws every section of the home, the switching tabs and the ended offer", () => {
    render(<SufiStore design={{ settings, sections }} data={data} storeName="صوفي" mode="preview" />);
    for (const text of ["أناقة تليق", "الأقسام", "رجالي", "اختياراتنا", "الشتاء", "الجمعة البيضاء", "وصل حديثًا", "شوف", "براندات", "قصتنا", "شحن سريع", "ممتاز", "معرض", "الشحن؟", "مدينة نصر", "شحن مجاني"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(t.countdown.ended)).toBeInTheDocument();
    expect(screen.getAllByText("ساعة كلاسيك")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: "عروض" }));
    expect(screen.getByText(t.empty.products)).toBeInTheDocument();
  });

  it("hides the dark-mode switch when the merchant turned it off, and previews the dark colors", () => {
    const { container } = render(<SufiStore design={{ settings: { ...settings, appearance: { default: "light", toggle: false } }, sections: [] }} data={data} storeName="صوفي" mode="preview" scheme="dark" />);
    expect(screen.queryByRole("button", { name: t.dark })).toBeNull();
    expect(container.querySelector(".sf-root")?.getAttribute("data-scheme")).toBe("dark");
  });

  it("turns video and map links into embeds", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
    expect(embedUrl("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871?autoplay=1");
    expect(embedUrl("https://example.com/v.mp4")).toBeNull();
    expect(mapEmbed({ name: "x", address: "عنوان", hours: null, phone: null, map_url: "https://www.google.com/maps/@30.06,31.34,15z" })).toContain("q=30.06%2C31.34");
    // A short link can't be read: the address is shown instead.
    expect(mapEmbed({ name: "x", address: "مدينة نصر", hours: null, phone: null, map_url: "https://maps.app.goo.gl/x" })).toContain(encodeURIComponent("مدينة نصر"));
  });
});
