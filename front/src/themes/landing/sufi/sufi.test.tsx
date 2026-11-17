import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";
import type { ProductOffer } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import type { LandingData } from "@/themes/landing/bidaya/types";
import { LANDING_BUILDER_THEMES } from "@/features/landings/themes";
import { LANDING_THEME_KEYS } from "../keys";
import { LANDING_THEMES, landingTheme } from "../registry";
import { SufiLandingPage } from "./page";
import { setBuilderScheme } from "./root";
import type { SufiLandingContent } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/oud", useSearchParams: () => new URLSearchParams() }));

const t = ar.sufiLanding;
const fields = { name: { enabled: true, required: true }, phone: { enabled: true, required: true }, phone2: { enabled: false, required: false }, email: { enabled: false, required: false }, governorate: { enabled: true, required: true }, city: { enabled: false, required: false }, address: { enabled: true, required: true }, notes: { enabled: false, required: false } };
const social = { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null };

const content: SufiLandingContent = {
  version: 1,
  settings: {
    colors: { primary: "#b9844f", secondary: "#17181c", background: "#faf8f4", text: "#17181c" },
    colors_dark: { primary: "#d49a60", secondary: "#f2f0ec", background: "#111215", text: "#f2f0ec" },
    appearance: { default: "light", toggle: true },
    font: "almarai",
    font_size: "medium",
    button: "pill",
    display_font: true,
    logo_media_id: null,
    logo_dark_media_id: null,
    header: { show: true, announcement: "شحن ببلاش لفترة محدودة", button_label: "اطلبه" },
    footer: { text: "عطور أصلية من 1998", phone: null, whatsapp: null, social },
    general: { sticky_order_button: true, whatsapp_button: false, animations: true },
  },
  sections: [
    { id: "hero000001", type: "hero", visible: true, props: { layout: "split", kicker: "إصدار محدود", title: "عود ملكي فاخر", highlight: "ملكي", subtitle: null, image_media_id: null, show_price: true, show_rating: true, button_label: "اطلبه دلوقتي", second_label: "اعرف التفاصيل", badges: ["أصلي 100%"] } },
    { id: "feat000001", type: "features", visible: true, props: { kicker: "ليه هتحبه", title: "الفرق في التفاصيل", subtitle: null, items: [{ icon: "gem", title: "خامة فاخرة", text: null }, { icon: "droplet", title: "ثبات 24 ساعة", text: null }] } },
    { id: "detl000001", type: "details", visible: true, props: { kicker: null, title: "عن قرب", rows: [{ image_media_id: null, title: "الزجاجة", text: "كريستال يدوي.", points: ["غطا معدن"] }] } },
    { id: "spec000001", type: "specs", visible: true, props: { kicker: null, title: "المواصفات", image_media_id: null, rows: [{ label: "الحجم", value: "100 مل" }, { label: "التركيز", value: "Extrait" }], note: null } },
    { id: "stat000001", type: "stats", visible: true, props: { kicker: null, title: null, items: [{ value: "+12 ألف", label: "عميل" }, { value: "4.9", label: "تقييم" }] } },
    { id: "bund000001", type: "bundles", visible: true, props: { kicker: null, title: "اختار العرض", subtitle: null, cards: [] } },
    { id: "cntd000001", type: "countdown", visible: true, props: { kicker: null, title: "العرض بيخلص", text: null, ends_at: "2000-01-01T00:00:00Z", show_stock: true } },
    { id: "form000001", type: "order_form", visible: true, props: { kicker: null, title: "اطلبه دلوقتي", subtitle: null, button_label: "أكّد الطلب", fields, offer_picker: true, show_quantity: true, points: ["تغليف فاخر"], image_media_id: null } },
    { id: "prom000001", type: "promises", visible: true, props: { items: [{ icon: "truck", title: "شحن لكل المحافظات", text: null }, { icon: "return", title: "استبدال سهل", text: null }] } },
    { id: "faq0000001", type: "faq", visible: true, props: { kicker: null, title: "أسئلة", items: [{ question: "أصلي؟", answer: "أيوه." }, { question: "الشحن؟", answer: "يومين." }] } },
  ],
};

const two: ProductOffer = { id: 3, name: "زجاجتين", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 2500, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 };

const data: LandingData = {
  page: { id: 9, slug: "oud", title: "عود ملكي" },
  store_name: "دار العطور",
  product: { id: 1, name: "عطر عود ملكي", slug: "oud", description: null, short_description: null, price: 1450, compare_at_price: 1800, available: true, stock_mode: "product", stock: 9, variant_stock: null, images: [], options: [] },
  offers: [two],
  media: {},
  reviews: [],
  shipping: { enabled: false },
};

beforeEach(() => {
  push.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (url.startsWith("/api/public/landing/form-token")) return Response.json({ data: { token: "tok" } });
      if (url === "/api/public/landing/quote") return Response.json({ data: { unit_price: 1450, quantity: body.quantity, base_subtotal: 1450 * body.quantity, offer: null, subtotal_after_offer: 1450 * body.quantity, code: null, code_error: null, shipping: null, total: 1450 * body.quantity } });
      return new Response(null, { status: 202 });
    }),
  );
});
afterEach(() => {
  cleanup();
  act(() => setBuilderScheme(null));
  vi.unstubAllGlobals();
});

const root = (container: HTMLElement) => container.querySelector(".sl-root") as HTMLElement;

describe("«صوفي · صفحة هبوط»", () => {
  it("draws its sections, the colored word and the stock left", () => {
    const { container } = render(<SufiLandingPage content={content} data={data} mode="preview" />);
    for (const text of ["شحن ببلاش لفترة محدودة", "إصدار محدود", "أصلي 100%", "خامة فاخرة", "الزجاجة", "غطا معدن", "100 مل", "+12 ألف", "تغليف فاخر", "استبدال سهل", "عطور أصلية من 1998"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(container.querySelector("h1 em")?.textContent).toBe("ملكي");
    // The offer ended, but the stock left keeps the countdown section up.
    expect(screen.getByText(t.countdown.left(9))).toBeInTheDocument();
  });

  it("lets the visitor switch to dark mode in the merchant's dark colors, and remembers it", () => {
    const { container } = render(<SufiLandingPage content={content} data={data} mode="live" />);
    expect(root(container)).toHaveAttribute("data-scheme", "light");
    expect(root(container).style.getPropertyValue("--as-bg")).toBe("#faf8f4");

    fireEvent.click(screen.getByRole("button", { name: t.toDark }));
    expect(root(container)).toHaveAttribute("data-scheme", "dark");
    expect(root(container).style.getPropertyValue("--as-bg")).toBe("#111215");
    expect(window.localStorage.getItem("sf_scheme")).toBe("dark");
    expect(screen.getByRole("button", { name: t.toLight })).toBeInTheDocument();
  });

  it("opens dark when the merchant says so, without a switch when it is off", () => {
    const dark = { ...content, settings: { ...content.settings, appearance: { default: "dark" as const, toggle: false } } };
    const { container } = render(<SufiLandingPage content={dark} data={data} mode="live" />);
    expect(root(container)).toHaveAttribute("data-scheme", "dark");
    expect(screen.queryByRole("button", { name: t.toLight })).toBeNull();
  });

  it("shows the Builder the scheme the merchant asks for", () => {
    const { container } = render(<SufiLandingPage content={content} data={data} mode="builder" />);
    expect(root(container)).toHaveAttribute("data-scheme", "light");
    act(() => setBuilderScheme("dark"));
    expect(root(container)).toHaveAttribute("data-scheme", "dark");
  });

  it("makes a card per running offer and picks it in the order form", async () => {
    render(<SufiLandingPage content={content} data={data} mode="preview" />);
    const cards = screen.getByRole("heading", { name: "اختار العرض" }).closest("section")!;
    expect(within(cards).getByText(formatMoney(2500))).toBeInTheDocument();

    const picks = within(cards).getAllByRole("button", { name: t.bundles.choose });
    fireEvent.click(picks[picks.length - 1]);
    await waitFor(() => expect(screen.getByRole("radio", { name: /زجاجتين/ })).toHaveAttribute("aria-checked", "true"));
  });

  it("draws the cover hero and hides an empty countdown on the live page", () => {
    const cover = { ...content, sections: content.sections.map((s) => (s.type === "hero" ? { ...s, props: { ...s.props, layout: "cover" as const } } : s)) };
    const quiet = { ...data, product: { ...data.product!, stock_mode: "unlimited" as const, stock: null } };
    const { container } = render(<SufiLandingPage content={cover} data={quiet} mode="live" />);
    expect(container.querySelector(".sl-cover")).not.toBeNull();
    expect(screen.queryByText("العرض بيخلص")).toBeNull();
  });
});

describe("landing theme registries", () => {
  it("know the same themes, and fall back to the free one", () => {
    expect(Object.keys(LANDING_THEMES).sort()).toEqual([...LANDING_THEME_KEYS].sort());
    expect(Object.keys(LANDING_BUILDER_THEMES).sort()).toEqual([...LANDING_THEME_KEYS].sort());
    expect(landingTheme("nope")).toBe(LANDING_THEMES.bidaya_landing);
  });

  it("make new sections every theme's page can draw, with a name in the Builder", () => {
    for (const key of LANDING_THEME_KEYS) {
      const theme = LANDING_BUILDER_THEMES[key];
      for (const type of theme.addable) {
        const section = theme.newSection(type, "منتج");
        expect(section.type).toBe(type);
        expect(ar.landings.builder.types[type]?.title).toBeTruthy();
      }
    }
  });
});
