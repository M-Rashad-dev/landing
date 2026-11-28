import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreConfig } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { ShopProvider } from "@/themes/store/shared/shop";
import type { DesignData, ProductCard } from "@/themes/store/shared/types";
import { splitChips } from "./card";
import { dealStock, dealTimeLeft, secondsToCairoMidnight } from "./deal";
import { installmentOf, monthlyAmount } from "./installments";
import { TeknoStore } from "./tekno-store";
import type { TeknoDesign, TeknoInstallments, TeknoSection } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

/* Stage T1 (docs/plans/tekno/PLAN.md §4): the «تيكنو» frame, card and home sections part 1. */

const t = ar.teknoStore;
const none = { type: "none" as const, target_id: null, url: null };
const all = { type: "all_products" as const, target_id: null, url: null };
const plan: TeknoInstallments = { enabled: true, months: [6, 12, 18, 24], card_months: 12, interest_percent: 0, min_price: 2000, providers: ["كروت البنوك"], note: null };

const settings: TeknoDesign["settings"] = {
  colors: { primary: "#2563eb", secondary: "#22d3ee", background: "#f2f4f8", text: "#0b1220", dark: "#0f1a2e", deal: "#a3e635" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  display_font: true,
  button: "rounded",
  header: { sticky: true, search: true, announcement: "شحن مجاني فوق 2000 ج", hotline: "19999", track_link: true, search_categories: true },
  footer: { about: "أجهزة أصلية بضمان الوكيل.", show_pages: true, phone: "19999", whatsapp: "01012345678", email: null, address: "القاهرة", social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, help_links: [2] },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24 },
  mega_menu: { enabled: true, items: [] },
  product_card: { show_specs: true, show_compare: true, show_rating: true, show_installment: true, low_stock: 5, badge_label: "الحالة", radius: 16 },
  installments: plan,
};

const card = (id: number, name: string, price: number, extra: Partial<ProductCard> = {}): ProductCard => ({ id, slug: `p-${id}`, name, short_description: null, price, compare_at_price: null, discount_percent: null, image: null, available: true, needs_options: false, max_quantity: null, rating: null, spec_chips: [], ...extra });

const phone = card(1, "موبايل 6.7 بوصة", 18499, { compare_at_price: 20999, discount_percent: 12, rating: { average: 4.8, count: 312 }, spec_chips: [{ label: "الرامات", value: "8GB" }, { label: "التخزين", value: "256GB" }, { label: "الحالة", value: "كسر زيرو" }] });
const buds = card(2, "سماعة لاسلكي", 1499, { max_quantity: 3, spec_chips: [{ label: "العزل", value: "ANC" }] });
const watch = card(3, "ساعة ذكية", 2599, { compare_at_price: 3999, discount_percent: 35, max_quantity: 14, spec_chips: [{ label: "البطارية", value: "بطارية 7 أيام" }, { label: "GPS", value: "GPS" }] });
const laptop = card(4, "لابتوب 14", 24999, { compare_at_price: 27500 });

const sections: TeknoSection[] = [
  { id: "hero00000001", type: "tech_hero", visible: true, props: {
    slides: [{ kicker: "وصل حديثًا", title: "لابتوب بأداء يجري معاك", highlight: "يجري", subtitle: null, media_id: null, chips: ["Core i7", "16GB RAM"], product_id: 4, button_label: "اشتري دلوقتي", link: all, second_label: "المواصفات كاملة", second_link: { type: "product", target_id: 4, url: null } }],
    tiles: [{ media_id: null, kicker: "سماعات", title: "صوت نقي وعزل ضوضاء", text: "من 1,499 ج.م", color: "#0e7490", link: { type: "search", target_id: null, url: "سماعات" } }],
  } },
  { id: "trust0000001", type: "features", visible: true, props: { title: null, items: [{ icon: "badge-check", title: "ضمان الوكيل", text: "سنة على الأقل" }, { icon: "wrench", title: "صيانة", text: null }] } },
  { id: "deal00000001", type: "deal_of_day", visible: true, props: { kicker: "عرض اليوم · بيخلص بالليل", product_id: 3, title: null, chips: null, ends: "midnight", ends_at: null, stock_start: 50, button_label: "الحق العرض", show_installment: true } },
  { id: "tabs00000001", type: "product_tabs", visible: true, props: { title: "اختار جهازك", description: null, limit: 10, kicker: "الأكثر طلبًا", tabs: [{ label: "الأكثر مبيعًا", source: "best_sellers", category_id: null, product_ids: [] }, { label: "عروض", source: "offers", category_id: null, product_ids: [] }] } },
  { id: "brands000001", type: "brands", visible: true, props: { title: "براندات بنتعامل معاها", items: [{ media_id: null, name: "NOVA", link: none }, { media_id: null, name: "ZENTRO", link: none }] } },
  { id: "serv00000001", type: "services", visible: true, props: { title: "الضمان وخدمة ما بعد البيع", items: [{ icon: "wrench", title: "مراكز صيانة", text: "في القاهرة" }, { icon: "headset", title: "دعم فني", text: null }] } },
  { id: "revs00000001", type: "testimonials", visible: true, props: { title: "آراء العملاء", source: "manual", items: [{ name: "أحمد · القاهرة", rating: 5, text: "اللابتوب وصل متغلّف.", product: "لابتوب 14" }] } },
];

const data = {
  products: { "hero00000001:0": [laptop], deal00000001: [watch], "tabs00000001:0": [phone, buds], "tabs00000001:1": [laptop] },
  view_all: {},
  links: { "hero00000001:0": "/products", "hero00000001:0:second": "/products/p-4", "hero00000001:tile:0": "/products?q=%D8%B3%D9%85%D8%A7%D8%B9%D8%A7%D8%AA" },
  media: {},
  categories: [
    { id: 10, parent_id: null, name: "لابتوبات", slug: "laptops" },
    { id: 11, parent_id: 10, name: "لابتوبات الطلبة", slug: "student" },
    { id: 12, parent_id: null, name: "موبايلات", slug: "phones" },
  ],
  pages: [{ id: 1, title: "سياسة الخصوصية", slug: "privacy" }, { id: 2, title: "الضمان والصيانة", slug: "warranty" }],
  reviews: [],
} as unknown as DesignData;

const config = { design: { settings, sections }, data, store_name: "تيكنو", theme_key: "tekno_store", payments: { cod: true, methods: [{ name: "فيزا" }] } } as unknown as StoreConfig;

const draw = (mode: "live" | "preview" = "preview", design: TeknoDesign = { settings, sections }) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShopProvider config={config}>
        <TeknoStore design={design} data={data} storeName="تيكنو" mode={mode} />
      </ShopProvider>
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("«تيكنو» installments, deal and card helpers", () => {
  it("rounds the monthly amount up from integer piastres, and shows it only from the minimum price", () => {
    expect(monthlyAmount(24999, 12, 0)).toBe(2084);
    expect(monthlyAmount(18499, 12, 0)).toBe(1542);
    expect(monthlyAmount(24999, 12, 10)).toBe(2292);
    expect(monthlyAmount(1200, 12, 0)).toBe(100);
    expect(installmentOf(18499, plan)).toEqual({ months: 12, amount: 1542 });
    expect(installmentOf(1499, plan)).toBeNull();
    expect(installmentOf(18499, { ...plan, enabled: false })).toBeNull();
  });

  it("counts «عرض اليوم» to midnight in Cairo, or to its date, and its sold share of the stock", () => {
    // 20:00 UTC on a winter day = 22:00 in Cairo: two hours left.
    const now = Date.UTC(2026, 11, 2, 20, 0, 0);
    expect(secondsToCairoMidnight(now)).toBe(7200);
    expect(dealTimeLeft({ ends: "midnight", ends_at: null }, now)).toMatchObject({ hours: 2, minutes: 0, seconds: 0, ended: false });
    expect(dealTimeLeft({ ends: "date", ends_at: "2026-12-02T19:00:00Z" }, now)?.ended).toBe(true);
    expect(dealTimeLeft({ ends: "midnight", ends_at: null }, null)).toBeNull();
    expect(dealStock(50, 14)).toEqual({ percent: 72, left: 14 });
    expect(dealStock(null, 14)).toBeNull();
    expect(dealStock(10, 14)).toBeNull();
    expect(dealStock(50, null)).toBeNull();
  });

  it("takes the merchant's «الحالة» row out of the chips line", () => {
    expect(splitChips(phone.spec_chips, "الحالة")).toEqual({ badge: { label: "الحالة", value: "كسر زيرو" }, line: [{ label: "الرامات", value: "8GB" }, { label: "التخزين", value: "256GB" }] });
    expect(splitChips(phone.spec_chips, null).line).toHaveLength(3);
  });
});

describe("«تيكنو» store", () => {
  it("draws the strip, the search with categories and the tools, and searches inside a chosen category", () => {
    draw();
    expect(screen.getByText("شحن مجاني فوق 2000 ج")).toBeInTheDocument();
    expect(screen.getByText(t.hotline("19999"))).toBeInTheDocument();
    const form = screen.getAllByRole("search")[0];
    expect(form).toHaveAttribute("action", "/products");
    fireEvent.change(within(form).getByRole("combobox", { name: t.searchIn }), { target: { value: "laptops" } });
    expect(form).toHaveAttribute("action", "/categories/laptops");
    for (const label of [t.compare, t.wishlist, t.account, t.cart]) expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    // The phone's bottom bar.
    expect(screen.getByRole("button", { name: t.menu })).toBeInTheDocument();
  });

  it("opens «كل الأقسام» with each category's sub-categories, or the merchant's columns and promo card", () => {
    const { unmount } = draw();
    fireEvent.click(screen.getByRole("button", { name: t.allCategories }));
    const menu = screen.getByRole("dialog", { name: t.allCategories });
    expect(within(menu).getByRole("link", { name: "لابتوبات الطلبة" })).toHaveAttribute("href", "/categories/student");
    unmount();

    const withItems = { ...settings, mega_menu: { enabled: true, items: [{ category_id: 10, columns: [{ title: "حسب السعر", links: [{ label: "أقل من 15 ألف", link: all }] }], promo: { media_id: null, title: "لابتوبات الطلبة", text: "خصم لحد 20%", link: all } }] } };
    const linked = { ...data, links: { ...data.links, "mega:0:0:0": "/products?max=15000", "mega:0:promo": "/categories/student" } } as DesignData;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TeknoStore design={{ settings: withItems, sections: [] }} data={linked} storeName="تيكنو" mode="preview" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: t.allCategories }));
    const custom = screen.getByRole("dialog", { name: t.allCategories });
    expect(within(custom).getByRole("heading", { name: "حسب السعر" })).toBeInTheDocument();
    expect(within(custom).getByRole("link", { name: "أقل من 15 ألف" })).toHaveAttribute("href", "/products?max=15000");
    expect(within(custom).getByRole("link", { name: /خصم لحد 20%/ })).toHaveAttribute("href", "/categories/student");
    // Only the categories the merchant put in the menu.
    expect(within(custom).queryByRole("link", { name: /موبايلات/ })).toBeNull();
  });

  it("draws the opening with the product's real price and monthly amount, and the side tile's link", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("لابتوب بأداء يجري معاك");
    expect(screen.getByText("يجري").tagName).toBe("EM");
    expect(screen.getByText(t.hero.installment(2084))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "المواصفات كاملة" })).toHaveAttribute("href", "/products/p-4");
    expect(screen.getByRole("link", { name: /صوت نقي وعزل ضوضاء/ })).toHaveAttribute("href", "/products?q=%D8%B3%D9%85%D8%A7%D8%B9%D8%A7%D8%AA");
  });

  it("shows «عرض اليوم» from its product: chips, price, the sold bar and the timer", () => {
    draw();
    expect(screen.getAllByText("ساعة ذكية").length).toBeGreaterThan(0);
    expect(screen.getByText("بطارية 7 أيام")).toBeInTheDocument();
    expect(screen.getByText(t.deal.off(35))).toBeInTheDocument();
    expect(screen.getByText(t.deal.installment(217))).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "72");
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "الحق العرض" })[0]).toHaveAttribute("href", "/products/p-3");
  });

  it("draws the cards with chips, the condition badge, the installment or stock line, and «قارن» kept in the browser", () => {
    draw("live");
    const cards = screen.getAllByRole("article");
    const first = cards.find((c) => within(c).queryByText("موبايل 6.7 بوصة"))!;
    expect(within(first).getByText("كسر زيرو")).toHaveClass("tk-cond");
    expect(within(first).getByRole("list")).toHaveTextContent("8GB256GB");
    expect(within(first).getByText(t.card.installment(1542), { exact: false })).toBeInTheDocument();
    expect(within(first).getByText(t.card.off(12))).toBeInTheDocument();
    const second = cards.find((c) => within(c).queryByText("سماعة لاسلكي"))!;
    expect(within(second).getByText(t.card.low(3))).toBeInTheDocument();

    const compare = within(first).getByRole("button", { name: t.card.compareAdd("موبايل 6.7 بوصة") });
    fireEvent.click(compare);
    expect(compare).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("as_compare_v1") ?? "[]")).toEqual([1]);
    expect(screen.getAllByRole("link", { name: t.count(t.compare, 1) }).length).toBeGreaterThan(0);
  });

  it("draws the tabs' kicker, brands by name, the services, reviews with what was bought, and the footer's pages and payments", () => {
    draw("live");
    expect(screen.getByText("الأكثر طلبًا")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "عروض" }));
    expect(screen.getAllByText("لابتوب 14").length).toBeGreaterThan(0);
    // A brand without a logo is its name (no link chosen: plain text).
    expect(screen.getByText("NOVA")).toBeInTheDocument();
    expect(screen.getByText("مراكز صيانة")).toBeInTheDocument();
    expect(screen.getByText(t.bought("لابتوب 14"))).toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    // Only the chosen help page, after «تابع طلبك».
    expect(within(footer).getByRole("link", { name: "الضمان والصيانة" })).toHaveAttribute("href", "/pages/warranty");
    expect(within(footer).queryByRole("link", { name: "سياسة الخصوصية" })).toBeNull();
    for (const pay of [t.footer.cod, "فيزا", t.footer.installments]) expect(within(footer).getByText(pay)).toBeInTheDocument();
  });

  it("asks the merchant to pick the deal's product in the Builder, and shows nothing for it on the live store", () => {
    const noProduct: TeknoSection[] = [{ id: "deal00000002", type: "deal_of_day", visible: true, props: { kicker: null, product_id: null, title: null, chips: null, ends: "midnight", ends_at: null, stock_start: null, button_label: "الحق العرض", show_installment: true } }];
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TeknoStore design={{ settings, sections: noProduct }} data={data} storeName="تيكنو" mode="builder" />
      </QueryClientProvider>,
    );
    expect(screen.getByText(t.empty.deal)).toBeInTheDocument();
    unmount();
    draw("live", { settings, sections: noProduct });
    expect(screen.queryByText(t.empty.deal)).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });
});
