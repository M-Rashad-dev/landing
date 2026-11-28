import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, clearCart } from "@/lib/store/cart";
import type { StoreConfig } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { freeShippingLeft, readCartNote } from "@/themes/store/shared/cart-note";
import { ShopProvider } from "@/themes/store/shared/shop";
import type { DesignData } from "@/themes/store/shared/types";
import { ShabeStoreRoot } from "../root";
import { CART_DEFAULTS, LISTING_DEFAULTS, type CartSettings, type ListingSettings, type ShabeStoreSettings } from "../types";
import { ShabeCartView } from "./cart";
import { ShabeListing } from "./listing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const ts = ar.shabeStore;
const all = { type: "all_products" as const, target_id: null, url: null };
const card = (id: number, name: string) => ({ id, slug: `p${id}`, name, short_description: null, price: 100, compare_at_price: null, discount_percent: null, image: null, available: true, needs_options: false, max_quantity: null, rating: null });

const settings = (listing: Partial<ListingSettings> = {}, cart: Partial<CartSettings> = {}): ShabeStoreSettings => ({
  colors: { primary: "#e4572e", secondary: "#f2b33d", background: "#fffaf2", text: "#1b120c", dark: "#17110d" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  display_font: false,
  button: "pill",
  header: { sticky: true, search: true, announcement: null, layout: "start", countdown_ends_at: null, hotline: null, button_label: null, button_link: all, categories_menu: false },
  footer: { about: null, show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, dark: true, payments: true },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: false },
  listing: { ...LISTING_DEFAULTS, ...listing },
  cart: { ...CART_DEFAULTS, ...cart },
});

const data = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [], cart_products: [card(1, "كفتة"), card(2, "أرز")] } as unknown as DesignData;
const config = { shipping: { enabled: true, fees: {}, unavailable: [], free_over: 500 } } as unknown as StoreConfig;

const draw = (ui: React.ReactNode, s: ShabeStoreSettings) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ShopProvider config={config}>
        <ShabeStoreRoot settings={s} data={data} storeName="شابع" mode="live">
          {ui}
        </ShabeStoreRoot>
      </ShopProvider>
    </QueryClientProvider>,
  );

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

describe("«شابع» cart", () => {
  it("shows what's left for free delivery, keeps the kitchen note for the checkout, and suggests what isn't in the cart", () => {
    act(() => {
      addToCart({ product_id: 1, quantity: 2, options: {}, name: "كفتة", slug: "p1", image: null, price: 100, options_label: "" });
    });
    draw(<ShabeCartView />, settings());
    expect(screen.getByText(ts.cartPage.freeLeft(300))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(ts.cartPage.notes), { target: { value: "من غير بصل" } });
    expect(readCartNote()).toBe("من غير بصل");

    expect(screen.getByRole("heading", { name: ts.cartPage.suggestions })).toBeInTheDocument();
    expect(screen.getByText("أرز")).toBeInTheDocument();
    expect(screen.queryAllByText("كفتة")).toHaveLength(1); // the line only, not suggested again
  });

  it("hides each part the merchant turned off", () => {
    act(() => {
      addToCart({ product_id: 1, quantity: 1, options: {}, name: "كفتة", slug: "p1", image: null, price: 100, options_label: "" });
    });
    draw(<ShabeCartView />, settings({}, { free_shipping_bar: false, suggestions_enabled: false, kitchen_notes: false }));
    expect(screen.queryByText(ts.cartPage.freeLeft(400))).toBeNull();
    expect(screen.queryByLabelText(ts.cartPage.notes)).toBeNull();
    expect(screen.queryByRole("heading", { name: ts.cartPage.suggestions })).toBeNull();
  });

  it("counts free delivery only when the store has a threshold", () => {
    expect(freeShippingLeft(200, 500)).toEqual({ left: 300, progress: 0.4 });
    expect(freeShippingLeft(600, 500)).toEqual({ left: 0, progress: 1 });
    expect(freeShippingLeft(200, null)).toBeNull();
  });
});

describe("«شابع» category pages", () => {
  const list = { data: [card(1, "كفتة"), card(2, "أرز")], meta: { current_page: 1, last_page: 1, per_page: 24, total: 2 } };
  const props = { title: "مشويات", breadcrumb: [{ name: "مشويات" }], subcategories: [{ name: "كفتة", slug: "kofta" }], list, filters: {}, basePath: "/categories/grill" };

  it("draws its sub-categories, the filters and the dishes in the merchant's columns", () => {
    draw(<ShabeListing {...props} />, settings({ columns_desktop: 3, columns_mobile: 1, subcategories: "chips", filters: "open" }));
    expect(screen.getByRole("heading", { level: 1, name: "مشويات" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "كفتة" }).map((l) => l.getAttribute("href"))).toContain("/categories/kofta");
    expect(screen.getByText(ar.storefront.list.apply)).toBeInTheDocument();
    const grid = screen.getAllByRole("list").find((l) => l.style.getPropertyValue("--cols-wide") === "3");
    expect(grid?.style.getPropertyValue("--cols")).toBe("1");
  });

  it("shows the spec filters in its filter panel, opened when the visitor already chose one", () => {
    const facets = [{ label: "الحجم", values: [{ value: "50 مل", count: 3 }] }];
    draw(<ShabeListing {...props} list={{ ...list, meta: { ...list.meta, facets } }} filters={{ spec: '{"الحجم":["50 مل"]}' }} />, settings({ filters: "button" }));
    expect(screen.getByRole("group", { name: ar.storefront.list.specs })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /50 مل/ })).toBeChecked();
  });

  it("keeps the filters behind a button, or hides them", () => {
    draw(<ShabeListing {...props} />, settings({ filters: "button" }));
    expect(screen.queryByText(ar.storefront.list.apply)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: ts.list.filters }));
    expect(screen.getByText(ar.storefront.list.apply)).toBeInTheDocument();
    cleanup();

    draw(<ShabeListing {...props} />, settings({ filters: "hidden" }));
    expect(screen.queryByRole("button", { name: ts.list.filters })).toBeNull();
  });
});
