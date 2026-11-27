import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPage } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import type { DesignData } from "@/themes/store/shared/types";
import { randomBetween } from "@/themes/store/shared/use-viewers";
import { ShabeProductView } from "./product";
import { ShabeStoreRoot } from "../root";
import { PAGE_DEFAULTS, type PageSettings, type ShabeStoreSettings } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const tp = ar.shabeStore.product;
const all = { type: "all_products" as const, target_id: null, url: null };

const settings = (page: Partial<PageSettings>): ShabeStoreSettings => ({
  colors: { primary: "#e4572e", secondary: "#f2b33d", background: "#fffaf2", text: "#1b120c", dark: "#17110d" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  display_font: false,
  button: "pill",
  header: { sticky: true, search: true, announcement: null, layout: "start", countdown_ends_at: null, hotline: null, button_label: null, button_link: all, categories_menu: false },
  footer: { about: null, show_pages: true, phone: null, whatsapp: "01000000000", email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null }, dark: true, payments: true },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: false },
  product_page: { ...PAGE_DEFAULTS, reviews: false, ...page },
});

const card = { id: 8, slug: "rice", name: "أرز بسمتي", short_description: null, price: 45, compare_at_price: null, discount_percent: null, image: null, available: true, needs_options: false, max_quantity: null, rating: null };
const page: ProductPage = {
  product: {
    id: 7,
    name: "كفتة مشوية",
    slug: "kofta",
    description: "لحمة بلدي",
    short_description: "½ كيلو",
    price: 220,
    compare_at_price: null,
    available: true,
    stock_mode: "none",
    stock: null,
    variant_stock: null,
    images: [],
    options: [],
  },
  offers: [],
  breadcrumb: [],
  seo: null,
  related: [card],
  low_stock_threshold: null,
  rating: { average: 0, count: 0, stars: {} },
} as unknown as ProductPage;

const data: DesignData = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [] };

const draw = (look: Partial<PageSettings>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShabeStoreRoot settings={settings(look)} data={data} storeName="شابع" mode="live">
        <ShabeProductView page={page} />
      </ShabeStoreRoot>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("«شابع» product page", () => {
  it("puts the buttons the merchant chose in the bar fixed at the bottom, with the quantity when it adds to the cart", () => {
    draw({ sticky_buttons: "buy" });
    let bar = screen.getByRole("region", { name: tp.quantity });
    expect(within(bar).getByRole("button", { name: new RegExp(tp.buyNow) })).toBeInTheDocument();
    expect(within(bar).queryByRole("group", { name: tp.quantity })).toBeNull();
    cleanup();

    draw({ sticky_buttons: "cart" });
    bar = screen.getByRole("region", { name: tp.quantity });
    expect(within(bar).getByRole("group", { name: tp.quantity })).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: new RegExp(tp.buyNow) })).toBeNull();
    cleanup();

    draw({ sticky_bar: false });
    expect(screen.queryByRole("region", { name: tp.quantity })).toBeNull();
  });

  it("shows «المواصفات» only when the product has some", () => {
    draw({});
    expect(screen.queryByRole("heading", { name: ar.specs.storefront.title })).toBeNull();
    cleanup();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ShabeStoreRoot settings={settings({})} data={data} storeName="شابع" mode="live">
          <ShabeProductView page={{ ...page, product: { ...page.product, specs: [{ name: "الأداء", rows: [{ label: "المعالج", value: "Core i5", in_card: true }] }] } }} />
        </ShabeStoreRoot>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: ar.specs.storefront.title })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "المعالج" }).nextElementSibling).toHaveTextContent("Core i5");
  });

  it("shows «اطلبه مع» and the WhatsApp question, each only when turned on", () => {
    draw({});
    expect(screen.getByRole("heading", { name: tp.related })).toBeInTheDocument();
    expect(screen.getByText("أرز بسمتي")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(tp.ask) })).toHaveAttribute("href", expect.stringContaining("wa.me/201000000000"));
    cleanup();

    draw({ related_enabled: false, whatsapp_ask: false });
    expect(screen.queryByRole("heading", { name: tp.related })).toBeNull();
    expect(screen.queryByRole("link", { name: new RegExp(tp.ask) })).toBeNull();
  });

  it("shows how many watch now: a number in the merchant's range, picked again on their beat", () => {
    vi.useFakeTimers();
    draw({ viewers: { enabled: true, min: 300, max: 600, every: 10 } });
    act(() => vi.advanceTimersByTime(1));
    const read = () => Number(screen.getByText(/بيتفرجوا/).textContent!.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    const first = read();
    expect(first).toBeGreaterThanOrEqual(300);
    expect(first).toBeLessThanOrEqual(600);
    act(() => vi.advanceTimersByTime(10_000));
    expect(read()).toBeGreaterThanOrEqual(300);
  });

  it("picks every whole number of the range, ends included", () => {
    expect(randomBetween(1, 999000, () => 0)).toBe(1);
    expect(randomBetween(1, 999000, () => 0.999999999)).toBe(999000);
    expect(randomBetween(5, 5)).toBe(5);
  });
});
