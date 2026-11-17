import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";
import type { ProductOffer } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import type { LandingData } from "@/themes/landing/bidaya/types";
import { ShabePage } from "./page";
import { dealOf } from "./sections";
import type { ShabeContent } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/box", useSearchParams: () => new URLSearchParams() }));

const t = ar.shabe;
const fields = { name: { enabled: true, required: true }, phone: { enabled: true, required: true }, phone2: { enabled: false, required: false }, email: { enabled: false, required: false }, governorate: { enabled: true, required: true }, city: { enabled: false, required: false }, address: { enabled: true, required: true }, notes: { enabled: false, required: false } };
const social = { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null };

const content: ShabeContent = {
  version: 1,
  settings: {
    colors: { primary: "#e4572e", secondary: "#f2b33d", background: "#fffaf2", text: "#1b120c", dark: "#17110d" },
    font: "cairo",
    font_size: "medium",
    button: "rounded",
    display_font: true,
    logo_media_id: null,
    header: { show: true, announcement: "عرض الافتتاح", countdown_ends_at: "2099-01-01T00:00:00Z", phone: "01001234567", button_label: "اطلب البوكس" },
    footer: { text: "مشويات على الفحم", phone: null, whatsapp: null, social },
    general: { sticky_order_button: true, whatsapp_button: false },
  },
  sections: [
    { id: "hero000001", type: "hero", visible: true, props: { kicker: "مشوي على الفحم", title: "بوكس مشويات شابع", highlight: "شابع", subtitle: null, image_media_id: null, stickers: ["يكفّي ٤ أفراد"], badge: "النهارده بس", show_price: true, show_rating: true, button_label: "اطلب دلوقتي", second_label: "شوف اللي فيه", trust: [{ icon: "bike", text: "توصيل في نفس اليوم" }] } },
    { id: "marq000001", type: "marquee", visible: true, props: { items: ["لحمة بلدي طازة"] } },
    { id: "menu000001", type: "menu", visible: true, props: { kicker: null, title: "إيه اللي جوه البوكس؟", subtitle: null, items: [{ image_media_id: null, title: "كفتة مشوية", text: null, tag: "½ كيلو" }], extras: ["طحينة"] } },
    { id: "bund000001", type: "bundles", visible: true, props: { kicker: null, title: "اختار البوكس", subtitle: null, cards: [] } },
    { id: "comp000001", type: "compare", visible: true, props: { title: "شابع ولا غيره؟", us: "شابع", them: "مطعم عادي", rows: [{ label: "الفحم", us: "✓", them: "✗" }, { label: "الدفع", us: "عند الاستلام", them: "مقدّم" }] } },
    { id: "urge000001", type: "urgency", visible: true, props: { title: "العرض بيخلص", text: null, ends_at: "2000-01-01T00:00:00Z", show_stock: true } },
    { id: "form000001", type: "order_form", visible: true, props: { kicker: null, title: "اطلب بوكسك", subtitle: null, button_label: "أكّد الطلب", fields, offer_picker: true, show_quantity: true, points: ["بيوصل سخن"], image_media_id: null } },
    { id: "faq0000001", type: "faq", visible: true, props: { title: "عندك سؤال؟", items: [{ question: "بيوصل إمتى؟", answer: "في ساعة." }, { question: "الدفع إزاي؟", answer: "كاش." }] } },
  ],
};

const bundle: ProductOffer = { id: 3, name: "بوكس العيلة", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 1500, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 };

const data: LandingData = {
  page: { id: 9, slug: "box", title: "بوكس العيلة" },
  store_name: "مطبخ شابع",
  product: { id: 1, name: "بوكس مشويات", slug: "box", description: null, short_description: null, price: 899, compare_at_price: 1150, available: true, stock_mode: "product", stock: 17, variant_stock: null, images: [], options: [] },
  offers: [bundle],
  media: {},
  reviews: [],
  shipping: { enabled: false },
};

beforeEach(() => {
  push.mockReset();
  // jsdom draws no layout: scrolling to the form is a no-op here.
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (url.startsWith("/api/public/landing/form-token")) return Response.json({ data: { token: "tok" } });
      if (url === "/api/public/landing/quote") return Response.json({ data: { unit_price: 899, quantity: body.quantity, base_subtotal: 899 * body.quantity, offer: null, subtotal_after_offer: 899 * body.quantity, code: null, code_error: null, shipping: null, total: 899 * body.quantity } });
      return new Response(null, { status: 202 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("«شابع»", () => {
  it("draws the food sections, the announcement countdown and the colored word", () => {
    const { container } = render(<ShabePage content={content} data={data} mode="preview" />);
    for (const text of ["عرض الافتتاح", "مشوي على الفحم", "يكفّي ٤ أفراد", "النهارده بس", "لحمة بلدي طازة", "كفتة مشوية", "½ كيلو", "طحينة", "شابع ولا غيره؟", "مطعم عادي", "اطلب بوكسك", "بيوصل سخن", "مشويات على الفحم"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(container.querySelector("h1 em")?.textContent).toBe("شابع");
    expect(screen.getByRole("timer", { name: t.endsIn })).toBeInTheDocument();
    // The offer ended, but the stock left keeps the section up.
    expect(screen.getByText(t.urgency.left(17))).toBeInTheDocument();
  });

  it("makes a card per running offer and picks it in the order form", async () => {
    render(<ShabePage content={content} data={data} mode="preview" />);
    const cards = screen.getByRole("heading", { name: "اختار البوكس" }).closest("section")!;
    expect(within(cards).getByText(formatMoney(1500))).toBeInTheDocument();
    expect(within(cards).getByText(formatMoney(1798))).toBeInTheDocument();

    const picks = within(cards).getAllByRole("button", { name: t.bundles.choose });
    fireEvent.click(picks[picks.length - 1]);
    await waitFor(() => expect(screen.getByRole("radio", { name: /بوكس العيلة/ })).toHaveAttribute("aria-checked", "true"));
    expect(within(cards).getByRole("button", { name: t.bundles.chosen })).toBeInTheDocument();
  });

  it("keeps one question open at a time", () => {
    render(<ShabePage content={content} data={data} mode="preview" />);
    const q1 = screen.getByRole("button", { name: /بيوصل إمتى؟/ });
    const q2 = screen.getByRole("button", { name: /الدفع إزاي؟/ });
    expect(q1).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(q2);
    expect(q1).toHaveAttribute("aria-expanded", "false");
    expect(q2).toHaveAttribute("aria-expanded", "true");
  });

  it("hides what has nothing to show on the live page", () => {
    const quiet = { ...data, offers: [], product: { ...data.product!, stock_mode: "unlimited" as const, stock: null } };
    render(<ShabePage content={content} data={quiet} mode="live" />);
    expect(screen.queryByText("العرض بيخلص")).toBeNull();
    // With no offers the single piece is the only card.
    expect(screen.getAllByRole("button", { name: t.bundles.choose })).toHaveLength(1);
  });

  it("prices an offer card the way the server does", () => {
    expect(dealOf(null, 100)).toMatchObject({ quantity: 1, total: 100, was: 100 });
    expect(dealOf(bundle, 899)).toMatchObject({ quantity: 2, total: 1500, was: 1798 });
    expect(dealOf({ ...bundle, type: "percentage", value: 25, required_quantity: 2, min_quantity: 2 }, 100)).toMatchObject({ total: 150 });
    expect(dealOf({ ...bundle, type: "fixed", value: 10, required_quantity: 3, min_quantity: 3 }, 100)).toMatchObject({ total: 270 });
    expect(dealOf({ ...bundle, type: "buy_get", min_quantity: 2, free_quantity: 1, required_quantity: 3 }, 100)).toMatchObject({ total: 200, was: 300 });
  });
});
