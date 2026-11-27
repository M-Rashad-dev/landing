import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCart } from "@/lib/store/cart";
import type { StoreConfig } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { ShopProvider } from "@/themes/store/shared/shop";
import type { DesignData } from "@/themes/store/shared/types";
import { RawaqStore } from "./rawaq-store";
import { quizResult } from "./sections";
import type { RawaqDesign, RawaqSection } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const t = ar.rawaqStore;
const none = { type: "none" as const, target_id: null, url: null };
const all = { type: "all_products" as const, target_id: null, url: null };

const settings: RawaqDesign["settings"] = {
  colors: { primary: "#b9507a", secondary: "#3d9a6f", background: "#fbf7f3", text: "#2b2226", dark: "#2b2226" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  display_font: true,
  button: "pill",
  header: { sticky: true, search: true, announcement: "توصيل مجاني", layout: "start", categories_menu: true },
  footer: { about: null, show_pages: true, phone: null, whatsapp: "01012345678", email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, dark: true, payments: true },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: false },
};

const product = (id: number, name: string, price: number, compare: number | null = null, extra = {}) => ({ id, slug: `p-${id}`, name, short_description: null, price, compare_at_price: compare, discount_percent: null, image: null, available: true, needs_options: false, max_quantity: null, rating: null, ...extra });

const sections: RawaqSection[] = [
  { id: "hero00000001", type: "glow_hero", visible: true, props: { kicker: null, title: "بشرة صافية من أول أسبوع", highlight: "صافية", subtitle: null, media_id: null, badge: "خصم 30%", rating: "4.9 من 2,300 عميلة", primary_label: "تسوّقي", primary_link: all, second_label: null, second_link: none, chips: ["أصلي 100%"] } },
  { id: "short0000001", type: "shortcuts", visible: true, props: { kicker: null, title: "حسب بشرتك", description: null, style: "circles", items: [
    { label: "دهنية", text: "48 منتج", media_id: null, color: null, link: { type: "category", target_id: 1, url: null } },
    { label: "سيروم", text: null, media_id: null, color: "#f6e2df", link: { type: "product", target_id: 7, url: null } },
  ] } },
  { id: "rout00000001", type: "routine", visible: true, props: { kicker: null, title: "روتين البشرة الدهنية", text: null, button_label: null, steps: [{ product_id: 8, label: "غسول", hint: "صباحًا" }, { product_id: 7, label: null, hint: null }] } },
  { id: "quiz00000001", type: "skin_quiz", visible: true, props: { kicker: null, title: "اعرفي روتينك", text: null, button_label: null,
    results: [
      { id: "oily", name: "بشرتك دهنية", text: "منظف خفيف", product_ids: [8, 7], category_id: 1 },
      { id: "dry", name: "بشرتك جافة", text: null, product_ids: [], category_id: null },
    ],
    questions: [
      { text: "آخر اليوم؟", answers: [{ text: "لامعة", results: ["oily"] }, { text: "ناشفة", results: ["dry"] }] },
      { text: "الكريمات؟", answers: [{ text: "حبوب", results: ["oily", "dry"] }, { text: "بتريحني", results: ["dry"] }] },
    ] } },
  { id: "tips00000001", type: "articles", visible: true, props: { kicker: null, title: "نصايح", items: [
    { media_id: null, tag: "البشرة", title: "ترتيب منتجاتك", body: "من الأخف\nللأتقل", link: { type: "search", target_id: null, url: "سيروم" } },
    { media_id: null, tag: null, title: "منتجات النياسيناميد", body: null, link: { type: "search", target_id: null, url: "نياسيناميد" } },
  ] } },
  { id: "cta000000001", type: "cta", visible: true, props: { title: "العروض أول بأول", text: null, button_label: "ابعتيلنا", action: "whatsapp", message: "عايزة العروض", link: none } },
];

const data = {
  products: { rout00000001: [product(8, "غسول", 290, 320), product(7, "سيروم", 450, 600)], "quiz00000001:0": [product(8, "غسول", 290, 320), product(7, "سيروم", 450, 600)], "quiz00000001:1": [] },
  view_all: {},
  links: { "quiz00000001:0": "/categories/oily", "quiz00000001:1": null, "tips00000001:0": "/products?q=%D8%B3%D9%8A%D8%B1%D9%88%D9%85", "tips00000001:1": "/products?q=nia", "hero00000001:primary": "/products", "short0000001:0": "/categories/oily", "short0000001:1": "/products/p-7" },
  media: {},
  categories: [{ id: 1, parent_id: null, name: "بشرة دهنية", slug: "oily" }],
  pages: [],
  reviews: [],
} as unknown as DesignData;

const config = { design: { settings, sections }, data, store_name: "رواق", theme_key: "rawaq_store" } as unknown as StoreConfig;

const draw = (mode: "live" | "preview" = "preview") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShopProvider config={config}>
        <RawaqStore design={{ settings, sections }} data={data} storeName="رواق" mode={mode} />
      </ShopProvider>
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("«رواق»", () => {
  it("draws the opening with its colored word, rating and badge, and shortcuts that open what the merchant chose", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("بشرة صافية من أول أسبوع");
    expect(screen.getByText("صافية").tagName).toBe("EM");
    expect(screen.getByText("4.9 من 2,300 عميلة")).toBeInTheDocument();
    expect(screen.getByText("خصم 30%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^دهنية/ })).toHaveAttribute("href", "/categories/oily");
    expect(screen.getByRole("link", { name: "سيروم" })).toHaveAttribute("href", "/products/p-7");
  });

  it("prices the routine from its products and adds them all to the cart in one click", () => {
    draw("live");
    expect(screen.getByText("740 ج.م")).toBeInTheDocument();
    expect(screen.getByText(t.routine.save(180))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.routine.add }));
    expect(screen.getByText(t.routine.added)).toBeInTheDocument();
    expect(parseCart(window.localStorage.getItem("as_cart_v1")).items.map((i) => i.product_id)).toEqual([8, 7]);
  });

  it("opens the store's WhatsApp with the ready message from the band", () => {
    draw();
    expect(screen.getByRole("link", { name: "ابعتيلنا" })).toHaveAttribute("href", `https://wa.me/201012345678?text=${encodeURIComponent("عايزة العروض")}`);
  });

  it("picks the result with the most votes from the answers, a tie going to the result listed first", () => {
    const quiz = (sections.find((x) => x.type === "skin_quiz")!.props as Extract<RawaqSection, { type: "skin_quiz" }>["props"]);
    expect(quizResult(quiz, [0, 0])).toBe(0);
    expect(quizResult(quiz, [1, 1])).toBe(1);
    expect(quizResult(quiz, [1, 0])).toBe(1);
    expect(quizResult(quiz, [0, 1])).toBe(0);
  });

  it("runs the quiz a question at a time, shows the result with its products and category, counts it once and remembers it", () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetch);
    draw("live");
    fireEvent.click(screen.getByRole("button", { name: t.quiz.start }));
    expect(screen.getByText(t.quiz.progress(1, 2))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ناشفة/ }));
    fireEvent.click(screen.getByRole("button", { name: t.quiz.back }));
    fireEvent.click(screen.getByRole("button", { name: /لامعة/ }));
    fireEvent.click(screen.getByRole("button", { name: /حبوب/ }));

    expect(screen.getByRole("heading", { name: "بشرتك دهنية" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.quiz.category })).toHaveAttribute("href", "/categories/oily");
    const sent = (fetch.mock.calls as unknown as Array<[string, RequestInit]>).filter(([url]) => url === "/api/public/store/quiz");
    expect(sent.map(([, init]) => JSON.parse(String(init.body)))).toEqual([{ section_id: "quiz00000001", result_id: "oily" }]);
    expect(window.localStorage.getItem("rq_quiz_quiz00000001")).toBe("oily");

    cleanup();
    draw("live");
    expect(screen.getByText(t.quiz.remembered)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "بشرتك دهنية" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("opens a tip in a reader with its text and link, and a tip without text opens its link", () => {
    draw();
    expect(screen.getByRole("link", { name: /منتجات النياسيناميد/ })).toHaveAttribute("href", "/products?q=nia");
    fireEvent.click(screen.getByRole("button", { name: /ترتيب منتجاتك/ }));
    const reader = screen.getByRole("dialog", { name: "ترتيب منتجاتك" });
    expect(reader).toHaveTextContent("من الأخف");
    expect(screen.getByRole("link", { name: t.articles.more })).toHaveAttribute("href", "/products?q=%D8%B3%D9%8A%D8%B1%D9%88%D9%85");
    fireEvent.click(screen.getAllByRole("button", { name: t.articles.close })[0]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
