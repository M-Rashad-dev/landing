import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, clearCart } from "@/lib/store/cart";
import type { ProductPage, StoreConfig } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { readCartNote } from "@/themes/store/shared/cart-note";
import { ShopProvider } from "@/themes/store/shared/shop";
import type { DesignData } from "@/themes/store/shared/types";
import { RawaqRoot } from "../root";
import { RAWAQ_CART_DEFAULTS, RAWAQ_LISTING_DEFAULTS, RAWAQ_PAGE_DEFAULTS, type RawaqCartSettings, type RawaqListingSettings, type RawaqPageSettings, type RawaqSettings } from "../types";
import { RawaqCartView } from "./cart";
import { RawaqListing } from "./listing";
import { RawaqProductView } from "./product";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const t = ar.rawaqStore;
const card = (id: number, name: string) => ({ id, slug: `p${id}`, name, short_description: null, price: 100, compare_at_price: null, discount_percent: null, image: null, available: true, needs_options: false, max_quantity: null, rating: null });

const settings = (page: Partial<RawaqPageSettings> = {}, listing: Partial<RawaqListingSettings> = {}, cart: Partial<RawaqCartSettings> = {}): RawaqSettings => ({
  colors: { primary: "#b9507a", secondary: "#3d9a6f", background: "#fbf7f3", text: "#2b2226", dark: "#2b2226" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  display_font: false,
  button: "pill",
  header: { sticky: true, search: true, announcement: null, layout: "start", categories_menu: false },
  footer: { about: null, show_pages: true, phone: null, whatsapp: "01000000000", email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, dark: true, payments: true },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: false },
  product_page: { ...RAWAQ_PAGE_DEFAULTS, reviews: false, ...page },
  listing: { ...RAWAQ_LISTING_DEFAULTS, ...listing },
  cart: { ...RAWAQ_CART_DEFAULTS, ...cart },
});

const data = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [], cart_products: [card(1, "سيروم"), card(2, "غسول")] } as unknown as DesignData;
const config = { shipping: { enabled: true, fees: {}, unavailable: [], free_over: 500 } } as unknown as StoreConfig;

const draw = (ui: React.ReactNode, s: RawaqSettings) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ShopProvider config={config}>
        <RawaqRoot settings={s} data={data} storeName="رواق" mode="live">
          {ui}
        </RawaqRoot>
      </ShopProvider>
    </QueryClientProvider>,
  );

const page = {
  product: { id: 7, name: "سيروم فيتامين C", slug: "serum", description: "**نضارة** من أول أسبوع", short_description: "30 مل", price: 450, compare_at_price: 600, available: true, stock_mode: "none", stock: null, variant_stock: null, images: [], options: [] },
  offers: [],
  breadcrumb: [],
  seo: null,
  related: [card(8, "مرطّب")],
  low_stock_threshold: null,
  rating: { average: 0, count: 0, stars: {} },
} as unknown as ProductPage;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ message: "x" }), { status: 500 }))));
});
afterEach(() => {
  cleanup();
  act(() => clearCart());
  vi.unstubAllGlobals();
});

describe("«رواق» product page", () => {
  it("shows the price and what she saves, the merchant's promises, «كمّلي روتينك» and the WhatsApp question", () => {
    draw(<RawaqProductView page={page} />, settings({ promises: ["مرخّص من وزارة الصحة", "أصلي 100%"] }));
    expect(screen.getByRole("heading", { level: 1, name: "سيروم فيتامين C" })).toBeInTheDocument();
    expect(screen.getByText(t.product.save(150))).toBeInTheDocument();
    expect(screen.getByText("مرخّص من وزارة الصحة")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t.product.related })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.product.ask })).toHaveAttribute("href", expect.stringContaining("wa.me/201000000000"));
  });

  it("shows «المواصفات» only when the product has some", () => {
    draw(<RawaqProductView page={page} />, settings({}));
    expect(screen.queryByRole("heading", { name: ar.specs.storefront.title })).toBeNull();
    cleanup();

    draw(<RawaqProductView page={{ ...page, product: { ...page.product, specs: [{ name: "الأداء", rows: [{ label: "المعالج", value: "Core i5", in_card: true }] }] } }} />, settings({}));
    expect(screen.getByRole("heading", { name: ar.specs.storefront.title })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "المعالج" }).nextElementSibling).toHaveTextContent("Core i5");
  });

  it("shows «أسئلة العملاء» with the published answers, and none when the store turned them off", () => {
    draw(<RawaqProductView page={{ ...page, questions: { count: 1, items: [{ id: 1, name: "سارة م.", question: "الضمان كام سنة؟", answer: "سنتين.", answered_at: null }] } }} />, settings({}));
    expect(screen.getByRole("heading", { name: new RegExp(ar.storefront.questions.title) })).toBeInTheDocument();
    expect(screen.getByText("سنتين.")).toBeInTheDocument();
    cleanup();

    draw(<RawaqProductView page={{ ...page, questions: null }} />, settings({}));
    expect(screen.queryByRole("heading", { name: new RegExp(ar.storefront.questions.title) })).toBeNull();
  });

  it("leaves out each part the merchant turned off, and puts her buttons in the bar at the bottom", () => {
    draw(<RawaqProductView page={page} />, settings({ promises: [], related_enabled: false, whatsapp_ask: false, description: false, sticky_buttons: "both" }));
    expect(screen.queryByRole("heading", { name: t.product.related })).toBeNull();
    expect(screen.queryByRole("link", { name: t.product.ask })).toBeNull();
    expect(screen.queryByRole("heading", { name: t.product.description })).toBeNull();
    const bar = screen.getByRole("region", { name: t.product.quantity });
    expect(within(bar).getByRole("button", { name: t.add })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: t.product.buyNow })).toBeInTheDocument();
  });
});

describe("«رواق» cart", () => {
  it("shows what's left for free delivery, keeps the order note for the checkout, and suggests what isn't in the cart", () => {
    act(() => {
      addToCart({ product_id: 1, quantity: 2, options: {}, name: "سيروم", slug: "p1", image: null, price: 100, options_label: "" });
    });
    draw(<RawaqCartView />, settings({}, {}, { order_notes: true }));
    expect(screen.getByText(t.cartPage.freeLeft(300))).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.cartPage.notes), { target: { value: "تغليف هدية" } });
    expect(readCartNote()).toBe("تغليف هدية");
    expect(screen.getByRole("heading", { name: t.cartPage.suggestions })).toBeInTheDocument();
    expect(screen.getByText("غسول")).toBeInTheDocument();
  });

  it("hides the note by default and each part the merchant turned off", () => {
    act(() => {
      addToCart({ product_id: 1, quantity: 1, options: {}, name: "سيروم", slug: "p1", image: null, price: 100, options_label: "" });
    });
    draw(<RawaqCartView />, settings({}, {}, { free_shipping_bar: false, suggestions_enabled: false }));
    expect(screen.queryByText(t.cartPage.freeLeft(400))).toBeNull();
    expect(screen.queryByLabelText(t.cartPage.notes)).toBeNull();
    expect(screen.queryByRole("heading", { name: t.cartPage.suggestions })).toBeNull();
  });
});

describe("«رواق» category pages", () => {
  const list = { data: [card(1, "سيروم"), card(2, "غسول")], meta: { current_page: 1, last_page: 1, per_page: 24, total: 2 } };
  const props = { title: "العناية بالبشرة", breadcrumb: [{ name: "العناية بالبشرة" }], subcategories: [{ name: "بشرة دهنية", slug: "oily" }], list, filters: {}, basePath: "/categories/skin" };

  it("draws its sub-categories, the filters and the products in the merchant's columns", () => {
    draw(<RawaqListing {...props} />, settings({}, { columns_desktop: 3, columns_mobile: 1, subcategories: "chips", filters: "open" }));
    expect(screen.getByRole("heading", { level: 1, name: "العناية بالبشرة" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "بشرة دهنية" })).toHaveAttribute("href", "/categories/oily");
    expect(screen.getByText(ar.storefront.list.apply)).toBeInTheDocument();
    const grid = screen.getAllByRole("list").find((l) => l.style.getPropertyValue("--cols-wide") === "3");
    expect(grid?.style.getPropertyValue("--cols")).toBe("1");
  });

  it("shows the spec filters in its filter panel, opened when the visitor already chose one", () => {
    const facets = [{ label: "الحجم", values: [{ value: "50 مل", count: 3 }] }];
    draw(<RawaqListing {...props} list={{ ...list, meta: { ...list.meta, facets } }} filters={{ spec: '{"الحجم":["50 مل"]}' }} />, settings({}, { filters: "button" }));
    expect(screen.getByRole("group", { name: ar.storefront.list.specs })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /50 مل/ })).toBeChecked();
  });

  it("keeps the filters behind a button", () => {
    draw(<RawaqListing {...props} />, settings({}, { filters: "button" }));
    expect(screen.queryByText(ar.storefront.list.apply)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.list.filters }));
    expect(screen.getByText(ar.storefront.list.apply)).toBeInTheDocument();
  });
});
