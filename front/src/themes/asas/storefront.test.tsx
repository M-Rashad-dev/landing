import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, clearCart, lineKey, MAX_CART_LINES, parseCart, setQuantity } from "@/lib/store/cart";
import { offerLabel, unitPriceAfter } from "@/lib/store/offers";
import type { ProductOffer, ProductPage, StoreConfig } from "@/lib/store/types";
import { jsonLdString } from "@/lib/public/seo";
import { listQuery, storeMetadata } from "@/lib/public/store";
import { parseSiteHost, primaryRedirectUrl } from "@/lib/public/host";
import { ar } from "@/messages/ar";
import { CheckoutView } from "./pages/checkout";
import { ProductView, unitsLeft, variantKey } from "./pages/product";
import { AsasRoot } from "./root";
import type { Design, DesignData } from "./types";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const design: Design = {
  settings: {
    colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" },
    font: "cairo",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    header: { sticky: true, search: true, announcement: null },
    footer: { about: null, show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
    general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24 },
  },
  sections: [],
};
const data: DesignData = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [] };
const config: StoreConfig = {
  theme_key: "asas",
  design,
  data,
  store_name: "نعناع",
  categories: [],
  pages: [],
  seo: { title: "نعناع", description: "أحلى متجر", canonical: "https://naanaa.com/", site_name: "نعناع" },
  tracking: null,
  shipping: { enabled: true, fees: { القاهرة: 50 }, unavailable: [], free_over: null },
  branding: true,
  primary_host: "naanaa.com",
};

const inTheme = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AsasRoot settings={design.settings} data={data} storeName="نعناع" mode="live">
        {ui}
      </AsasRoot>
    </QueryClientProvider>,
  );

const shirt: ProductPage = {
  product: {
    id: 7,
    name: "قميص",
    slug: "shirt",
    description: "**قطن** 100%",
    short_description: null,
    price: 300,
    compare_at_price: 400,
    available: true,
    stock_mode: "variant",
    stock: null,
    variant_stock: { "11-21": 3, "12-21": 0 },
    images: [],
    options: [
      { id: 1, name: "المقاس", display_type: "buttons", is_required: true, values: [{ id: 11, label: "M", color_hex: null, price_delta: 0 }, { id: 12, label: "XL", color_hex: null, price_delta: 20 }] },
      { id: 2, name: "اللون", display_type: "swatch", is_required: true, values: [{ id: 21, label: "أحمر", color_hex: "#ff0000", price_delta: 0 }] },
    ],
  },
  offers: [],
  breadcrumb: [{ name: "قمصان", slug: "shirts" }],
  seo: null,
  related: [],
  low_stock_threshold: 5,
  rating: { average: 0, count: 0, stars: {} },
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockReset();
  replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cart", () => {
  const item = (product_id: number, options: Record<string, number> = {}) => ({ product_id, quantity: 1, options, name: "x", slug: "x", image: null, price: 10, options_label: "" });

  it("merges the same product and options into one line, never past the line limit", () => {
    act(() => {
      addToCart(item(1, { "2": 21, "1": 11 }));
      addToCart({ ...item(1, { "1": 11, "2": 21 }), quantity: 2 });
    });
    const cart = parseCart(window.localStorage.getItem("as_cart_v1"));
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(lineKey(cart.items[0])).toBe("1|1:11,2:21");

    act(() => {
      clearCart();
      for (let i = 1; i <= MAX_CART_LINES; i++) addToCart(item(i));
    });
    expect(addToCart(item(999))).toBe("full");
  });

  it("never goes past the stock: more clicks add to the same line up to it", () => {
    act(() => {
      expect(addToCart({ ...item(5), max: 2 })).toBe("added");
      expect(addToCart({ ...item(5), max: 2 })).toBe("added");
      expect(addToCart({ ...item(5), max: 2 })).toBe("max");
    });
    expect(parseCart(window.localStorage.getItem("as_cart_v1")).items).toEqual([{ ...item(5), max: 2, quantity: 2 }]);
    act(() => setQuantity(lineKey(item(5)), 9));
    expect(parseCart(window.localStorage.getItem("as_cart_v1")).items[0].quantity).toBe(2);
    expect(addToCart({ ...item(6), max: 0 })).toBe("max");
  });

  it("ignores a damaged or tampered cart", () => {
    expect(parseCart("{bad")).toEqual({ items: [] });
    expect(parseCart(JSON.stringify({ items: [{ product_id: "1" }, { ...item(2), quantity: 999 }] })).items).toEqual([{ ...item(2), quantity: 50 }]);
  });
});

describe("store helpers", () => {
  it("keeps list queries bounded and drops unknown keys", () => {
    expect(listQuery({ q: "  ساعة ", sort: "price_asc", min: "100", max: "abc", in_stock: "1", page: "1", hack: "x" })).toEqual({ q: "ساعة", sort: "price_asc", min: "100", in_stock: "1" });
    expect(listQuery({ sort: "drop table", page: "3" }, { category: "shoes" })).toEqual({ category: "shoes", page: "3" });
  });

  it("parses hosts and builds the primary-host redirect", () => {
    expect(parseSiteHost("Shop.Example.com")).toBe("shop.example.com");
    expect(parseSiteHost("bad host")).toBeNull();
    expect(primaryRedirectUrl("shop.com", "/products?q=1")).toBe("https://shop.com/products?q=1");
    expect(primaryRedirectUrl("s.localhost", "/", { scheme: "http", port: "3200" })).toBe("http://s.localhost:3200/");
  });

  it("titles pages with the store name once, and keeps searches out of search engines", () => {
    const meta = storeMetadata(config, { title: "قميص", path: "/products/shirt", noindex: true });
    expect(meta.title).toEqual({ absolute: "قميص | نعناع" });
    expect(meta.alternates?.canonical).toBe("https://naanaa.com/products/shirt");
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(storeMetadata(config, { path: "/" }).title).toEqual({ absolute: "نعناع" });
  });

  it("never lets store text close the JSON-LD script", () => {
    const out = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });

  it("describes offers and the headline price after them", () => {
    const offer = (o: Partial<ProductOffer>): ProductOffer => ({ id: 1, name: "عرض", type: "percentage", value: 10, min_quantity: 1, free_quantity: null, required_quantity: 1, gift: null, bundle_quantity: null, bundle_price: null, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 0, ...o });
    expect(offerLabel(offer({ type: "buy_get", min_quantity: 2, free_quantity: 1 }))).toBe(ar.storefront.offers.buyGet(2, 1));
    expect(offerLabel(offer({ badge_text: "عرض العيد" }))).toBe("عرض العيد");
    expect(unitPriceAfter([offer({ value: 10 }), offer({ id: 2, type: "fixed", value: 50 })], 300)).toBe(250);
    expect(unitPriceAfter([offer({ value: 10, min_quantity: 2 })], 300)).toBeNull();
    expect(unitPriceAfter([offer({ status: "scheduled" })], 300)).toBeNull();
  });
});

describe("product page", () => {
  it("reads stock per combination of the required options", () => {
    expect(variantKey(shirt.product.options, { 2: 21 })).toBeNull();
    expect(variantKey(shirt.product.options, { 2: 21, 1: 12 })).toBe("12-21");
    expect(unitsLeft(shirt, { 1: 11, 2: 21 })).toBe(3);
    expect(unitsLeft(shirt, { 1: 12, 2: 21 })).toBe(0);
  });

  it("asks for the options first, then adds the choice with its price and label", () => {
    inTheme(<ProductView page={shirt} />);
    // The only color is chosen already; the sold-out size cannot be picked.
    expect(screen.getByRole("radio", { name: "أحمر" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /XL/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: ar.storefront.addToCart }));
    expect(screen.getByRole("alert")).toHaveTextContent(ar.storefront.product.pickAll);

    fireEvent.click(screen.getByRole("radio", { name: "M" }));
    expect(screen.getByText(ar.storefront.product.lowStock(3))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.product.increase }));
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.addToCart }));

    const cart = parseCart(window.localStorage.getItem("as_cart_v1"));
    expect(cart.items).toEqual([{ product_id: 7, quantity: 2, options: { "1": 11, "2": 21 }, name: "قميص", slug: "shirt", image: null, price: 300, options_label: "المقاس: M، اللون: أحمر", max: 3 }]);
    // The button says it is in the cart; the stock (3) is the limit.
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.product.inCart(2) }));
    expect(screen.getByRole("button", { name: ar.storefront.product.inCart(3) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.product.inCart(3) }));
    expect(screen.getByRole("alert")).toHaveTextContent(ar.storefront.product.maxReached(3));
  });

  it("goes straight to checkout with «اشتري دلوقتي»", () => {
    inTheme(<ProductView page={{ ...shirt, product: { ...shirt.product, stock_mode: "unlimited", variant_stock: null, options: [] } }} />);
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.product.buyNow }));
    expect(push).toHaveBeenCalledWith("/checkout");
  });
});

describe("checkout", () => {
  const quote = { lines: [{ product_id: 7, name: "قميص", quantity: 1, unit_price: 300, subtotal: 300, offer: null, offer_discount: 0, total: 300, options: [], gift: null }], items_count: 1, subtotal: 300, offer_discount: 0, code: null, code_discount: 0, code_error: null, shipping: 50, shipping_original: 50, shipping_free: false, shipping_available: true, shipping_company: { id: 3, name: "بوسطة", days_min: 2, days_max: 3 }, shipping_offer: null, shipping_by_code: false, shipping_options: [], total: 350 };

  function stubFetch(order: () => Response) {
    const calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url.endsWith("/form-token")) return Response.json({ data: { token: "tok-1" } });
        if (url.endsWith("/quote")) return Response.json({ data: quote });
        if (url.endsWith("/orders")) return order();
        if (url.includes("/store/account")) return Response.json({ code: "signed_out" }, { status: 401 });
        return new Response(null, { status: 202 });
      }),
    );
    return calls;
  }

  const fill = () => {
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.name)), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.phone)), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.governorate)), { target: { value: "القاهرة" } });
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.address)), { target: { value: "15 شارع النيل، الدور 3" } });
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.email)), { target: { value: "sara@mail.com" } });
  };

  it("sends the order with the token and the cart, then clears the cart and thanks the customer", async () => {
    addToCart({ product_id: 7, quantity: 1, options: {}, name: "قميص", slug: "shirt", image: null, price: 300, options_label: "" });
    const calls = stubFetch(() => Response.json({ data: { order_number: 1042, total: 350 } }, { status: 201 }));
    inTheme(<CheckoutView config={config} />);

    await screen.findByText("350 ج.م", undefined, { timeout: 3000 });
    fill();
    await waitFor(() => expect(screen.getByRole("button", { name: ar.storefront.checkout.submit })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.checkout.submit }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/checkout/done?order=1042&total=350"));
    const order = calls.find((c) => c.url.endsWith("/orders"))!.body!;
    expect(order).toMatchObject({ items: [{ product_id: 7, quantity: 1, options: {} }], customer: { name: "سارة", phone: "01012345678", governorate: "القاهرة", address: "15 شارع النيل، الدور 3", city: null, email: "sara@mail.com" }, form_token: "tok-1", shipping_company_id: 3, website: "" });
    expect(parseCart(window.localStorage.getItem("as_cart_v1")).items).toHaveLength(0);
  });

  it("checks the form before sending, and puts the server's errors on their fields", async () => {
    addToCart({ product_id: 7, quantity: 1, options: {}, name: "قميص", slug: "shirt", image: null, price: 300, options_label: "" });
    const calls = stubFetch(() => Response.json({ message: "خطأ", errors: { "customer.address": ["العنوان قصير"], "items.0.quantity": ["الكمية المتاحة 0"] } }, { status: 422 }));
    inTheme(<CheckoutView config={config} />);
    await screen.findByText("350 ج.م", undefined, { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: ar.storefront.checkout.submit }));
    expect(await screen.findByText(ar.storefront.checkout.errors.phone)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/orders"))).toBe(false);

    fill();
    // The email is optional, but a wrong one is caught.
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.email)), { target: { value: "sara@" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.checkout.submit }));
    expect(await screen.findByText(ar.storefront.checkout.errors.email)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.email)), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.checkout.submit }));
    expect(await screen.findByText("العنوان قصير")).toBeInTheDocument();
    expect(screen.getByText("الكمية المتاحة 0")).toBeInTheDocument();
    expect(screen.getByText(ar.storefront.checkout.errors.cart)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
