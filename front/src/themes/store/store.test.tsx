import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, cartCount, cartPayload, clearCart, lineKey, parseCart, removeFromCart, setQuantity, MAX_CART_LINES, type CartItem } from "@/lib/store/cart";
import { DEMO_IDENTITIES, DEMO_IMAGES, demoContext } from "@/themes/dev/fixtures";
import { getTheme, THEMES, themesOfKind } from "@/themes/registry";
import { SCHEMAS, type CategoryGridProps, type ProductGridProps } from "@/themes/shared/schemas";
import { categoriesFor, productsFor } from "@/themes/shared/store/store-blocks";
import { descendantIds, storePaths } from "@/themes/shared/store/links";
import { ProductCard } from "@/themes/shared/store/product-card";
import { SiteRenderer } from "@/themes/site-renderer";
import { STORE_HOME_TYPES, STORE_SECTION_TYPES, typesForKind, type PageContext, type Section, type StoreCategory, type StoreProductCard } from "@/themes/types";
import { STORE_LOOKS, storeLook } from "./look";
import { unitsLeft, type PurchaseProduct } from "./product-purchase";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const card = (id: number, over: Partial<StoreProductCard> = {}): StoreProductCard => ({
  id,
  slug: `p-${id}`,
  name: `منتج ${id}`,
  short_description: null,
  price: 100 + id,
  compare_at_price: null,
  discount_percent: null,
  image: DEMO_IMAGES[0],
  available: true,
  is_featured: false,
  needs_options: false,
  ...over,
});

const category = (id: number, parent: number | null, name = `تصنيف ${id}`): StoreCategory => ({ id, parent_id: parent, depth: parent === null ? 0 : 1, name, slug: `c-${id}`, description: null, image: null, products_count: id, seo: null });

const item = (over: Partial<CartItem> = {}): CartItem => ({ product_id: 1, quantity: 1, options: {}, name: "تيشيرت", slug: "t", image: null, price: 100, options_label: "", ...over });

function storeCtx(store: PageContext["store"], isPreview = false): PageContext {
  return demoContext(DEMO_IDENTITIES.violet, { isPreview, product: null, offers: [], store });
}

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  clearCart();
});

describe("store themes", () => {
  it("every store theme has a layout look and sections in the look of a landing theme", () => {
    const stores = themesOfKind("store");
    expect(stores.map((t) => t.key).sort()).toEqual(["diwan", "rewaq"]);
    for (const theme of stores) {
      expect(STORE_LOOKS[theme.key], theme.key).toBeDefined();
      for (const type of STORE_SECTION_TYPES) expect(theme.components[type].variants.length).toBeGreaterThanOrEqual(2);
    }
    expect(storeLook("unknown")).toBe(STORE_LOOKS.rewaq);
  });

  it("offers only store-home sections on the store home, and no store sections on landing pages", () => {
    expect(typesForKind("store_home")).toEqual(STORE_HOME_TYPES);
    for (const type of STORE_SECTION_TYPES) expect(typesForKind("landing")).not.toContain(type);
    expect(typesForKind("landing")).toContain("order_form");
  });

  it("switching rewaq ⇄ diwan keeps the store home texts and products", () => {
    const sections: Section[] = [
      { id: "s1", type: "product_grid", variant: "", visible: true, props: { ...SCHEMAS.product_grid.defaults, title: "وصل حديثًا" } },
      { id: "s2", type: "category_grid", variant: "", visible: true, props: { ...SCHEMAS.category_grid.defaults, title: "تسوق حسب التصنيف" } },
      { id: "s3", type: "promo_banner", variant: "", visible: true, props: { ...SCHEMAS.promo_banner.defaults, image_media_id: DEMO_IMAGES[3].id } },
      { id: "s4", type: "banner_slider", variant: "", visible: true, props: { ...SCHEMAS.banner_slider.defaults, slides: [{ image_media_id: DEMO_IMAGES[3].id, mobile_image_media_id: null, title: "بانر أول", subtitle: "", cta_label: "تسوق", cta_url: "/products" }] } },
    ];
    const ctx = storeCtx({ categories: [category(1, null, "رجالي")], products: { s1: [card(1), card(2)] } });
    for (const key of ["rewaq", "diwan"]) {
      const { container, unmount } = render(<SiteRenderer themeKey={key} sections={sections} ctx={ctx} />);
      for (const text of ["وصل حديثًا", "تسوق حسب التصنيف", "رجالي", "منتج 1", "منتج 2", SCHEMAS.promo_banner.defaults.title as string, "بانر أول"]) expect(container.textContent, `${key}: ${text}`).toContain(text);
      expect(container.querySelector(`a[href="${storePaths.product("p-1")}"]`)).not.toBeNull();
      unmount();
    }
    expect(getTheme("diwan").kind).toBe("store");
  });

  it("keeps empty store sections out of the live page and shows a hint in the builder", () => {
    const sections: Section[] = [{ id: "e", type: "product_grid", variant: "grid", visible: true, props: SCHEMAS.product_grid.defaults }];
    const live = render(<SiteRenderer themeKey="rewaq" sections={sections} ctx={storeCtx({ categories: [], products: {} })} />);
    expect(live.container.textContent).toBe("");
    live.unmount();
    const preview = render(<SiteRenderer themeKey="rewaq" sections={sections} ctx={storeCtx({ categories: [], products: {} }, true)} />);
    expect(preview.container.textContent).not.toBe("");
  });
});

describe("store section data", () => {
  const categories = [category(1, null), category(2, 1), category(3, 2), category(4, null)];

  it("walks the category tree", () => {
    expect([...descendantIds(categories, 1)].sort()).toEqual([1, 2, 3]);
    expect(categoriesFor(storeCtx({ categories, products: {} }), { ...(SCHEMAS.category_grid.defaults as CategoryGridProps), source: "top" }).map((c) => c.id)).toEqual([1, 4]);
    expect(categoriesFor(storeCtx({ categories, products: {} }), { ...(SCHEMAS.category_grid.defaults as CategoryGridProps), source: "children", parent_id: 1 }).map((c) => c.id)).toEqual([2]);
  });

  it("uses the server products live and filters the sample in the builder", () => {
    const sample = [card(1, { is_featured: true, category_ids: [3] }), card(2), card(3, { category_ids: [4] })];
    const props: ProductGridProps = { ...(SCHEMAS.product_grid.defaults as ProductGridProps), limit: 8 };
    expect(productsFor(storeCtx({ categories, products: { s: [card(9)] } }), "s", props).map((p) => p.id)).toEqual([9]);
    const preview = storeCtx({ categories, products: {}, sample }, true);
    expect(productsFor(preview, "x", { ...props, source: "featured" }).map((p) => p.id)).toEqual([1]);
    expect(productsFor(preview, "x", { ...props, source: "category", category_id: 1 }).map((p) => p.id)).toEqual([1]);
    expect(productsFor(preview, "x", { ...props, limit: 2 })).toHaveLength(2);
  });
});

describe("cart", () => {
  it("merges the same product + options into one line and keeps others apart", () => {
    addToCart(item({ options: { 5: 9 } }));
    addToCart(item({ options: { 5: 9 }, quantity: 2 }));
    addToCart(item({ options: { 5: 8 } }));
    const cart = parseCart(window.localStorage.getItem("lp_cart_v1"));
    expect(cart.items).toHaveLength(2);
    expect(cartCount(cart)).toBe(4);
    expect(cartPayload(cart)[0]).toEqual({ product_id: 1, quantity: 3, options: { 5: 9 } });
  });

  it("changes quantities, removes lines and caps the cart", () => {
    addToCart(item());
    const key = lineKey(item());
    setQuantity(key, 999);
    expect(parseCart(window.localStorage.getItem("lp_cart_v1")).items[0].quantity).toBe(50);
    removeFromCart(key);
    expect(parseCart(window.localStorage.getItem("lp_cart_v1")).items).toHaveLength(0);
    for (let i = 1; i <= MAX_CART_LINES; i++) expect(addToCart(item({ product_id: i }))).toBe(true);
    expect(addToCart(item({ product_id: 999 }))).toBe(false);
  });

  it("ignores a broken or tampered saved cart", () => {
    expect(parseCart("{bad").items).toEqual([]);
    expect(parseCart(JSON.stringify({ items: [{ product_id: "x" }, item({ quantity: -4 })] })).items).toEqual([item({ quantity: 1 })]);
  });

  it("adds from a product card and shows the confirmation", () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 202 }))) as unknown as typeof fetch;
    render(<ProductCard product={card(1)} look="malak" />);
    fireEvent.click(screen.getByRole("button", { name: /أضف للسلة/ }));
    expect(cartCount(parseCart(window.localStorage.getItem("lp_cart_v1")))).toBe(1);
    expect(screen.getAllByText(/اتضاف للسلة/).length).toBeGreaterThan(0);
  });

  it("sends visitors who must pick options to the product page", () => {
    render(<ProductCard product={card(1, { needs_options: true })} look="layali" />);
    expect(screen.getByRole("link", { name: /اختر المواصفات/ })).toHaveAttribute("href", "/products/p-1");
    expect(screen.queryByRole("button", { name: /أضف للسلة/ })).toBeNull();
  });
});

describe("stock on the product page", () => {
  const base: PurchaseProduct = {
    id: 1,
    name: "ب",
    description: null,
    price: 50,
    compare_at_price: null,
    available: true,
    images: [],
    options: [{ id: 7, name: "المقاس", display_type: "buttons", is_required: true, values: [{ id: 70, label: "M", color_hex: null, price_delta: 0 }, { id: 71, label: "L", color_hex: null, price_delta: -5 }] }],
  };

  it("knows what is left per product and per combination", () => {
    expect(unitsLeft({ ...base, stock_mode: "unlimited" }, {})).toBeNull();
    expect(unitsLeft({ ...base, stock_mode: "product", stock: 3 }, {})).toBe(3);
    const variant = { ...base, stock_mode: "variant" as const, variant_stock: { "70": 2 } };
    expect(unitsLeft(variant, {})).toBeNull();
    expect(unitsLeft(variant, { 7: 70 })).toBe(2);
    expect(unitsLeft(variant, { 7: 71 })).toBe(0);
  });
});

describe("registry", () => {
  it("lists landing and store themes apart", () => {
    expect(themesOfKind("landing").map((t) => t.key)).toEqual(["malak", "celia", "layali"]);
    expect(Object.keys(THEMES)).toHaveLength(5);
  });
});
