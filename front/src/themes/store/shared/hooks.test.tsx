import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCart } from "@/lib/store/cart";
import type { ProductPage } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { useSignIn } from "./use-account";
import { useListing } from "./use-listing";
import { useProductBuy } from "./use-product-buy";
import { useTrackOrder } from "./use-track";

// The logic every store theme's pages are built on, tested without any look.
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const shirt: ProductPage = {
  product: {
    id: 7,
    name: "قميص",
    slug: "shirt",
    description: null,
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
  breadcrumb: [],
  seo: null,
  related: [],
  low_stock_threshold: 5,
  rating: { average: 0, count: 0, stars: {} },
};

const withQuery = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockReset();
  replace.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(() => json({})));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useProductBuy", () => {
  it("prices the choice, knows the stock of each value, and asks for what's missing before adding", () => {
    const { result } = renderHook(() => useProductBuy(shirt));
    // The only color is chosen already; the size is not.
    expect(result.current.chosen).toEqual({ 2: 21 });
    expect(result.current.price).toBe(300);
    expect(result.current.compare).toBe(400);
    expect(result.current.valueOut(shirt.product.options[0], 12)).toBe(true);

    act(() => result.current.add("cart"));
    expect(result.current.lacking(shirt.product.options[0])).toBe(true);
    expect(result.current.message).toBe(ar.storefront.product.pickAll);
    expect(parseCart(window.localStorage.getItem("as_cart_v1")).items).toHaveLength(0);

    act(() => result.current.choose(1, 12));
    expect(result.current.price).toBe(320);
    expect(result.current.soldOut).toBe(true);

    act(() => result.current.choose(1, 11));
    expect(result.current.left).toBe(3);
    expect(result.current.low).toBe(true);
    act(() => result.current.add("cart"));
    expect(parseCart(window.localStorage.getItem("as_cart_v1")).items[0]).toMatchObject({ product_id: 7, quantity: 1, price: 300, options_label: "المقاس: M، اللون: أحمر" });
    expect(result.current.inCart).toBe(1);

    act(() => result.current.add("checkout"));
    expect(push).toHaveBeenCalledWith("/checkout");
  });
});

describe("useListing", () => {
  it("keeps the filters in the link and goes back to page 1 when they change", () => {
    const { result } = renderHook(() => useListing({ q: "قميص", page: "3" }, "/products"));
    expect(result.current.filtered).toBe(true);
    expect(result.current.pageHref(2)).toBe(`/products?q=${encodeURIComponent("قميص")}&page=2`);
    expect(result.current.pageHref(1)).toBe(`/products?q=${encodeURIComponent("قميص")}`);

    result.current.sort("price_asc");
    expect(push).toHaveBeenLastCalledWith(`/products?q=${encodeURIComponent("قميص")}&sort=price_asc`);
    result.current.price("100", "abc");
    expect(push).toHaveBeenLastCalledWith(`/products?q=${encodeURIComponent("قميص")}&min=100`);
    result.current.clear();
    expect(push).toHaveBeenLastCalledWith("/products");
  });
});

describe("useTrackOrder", () => {
  it("checks the number and phone before asking, then shows where the order is", async () => {
    const order = { number: 12, stage: "shipped" };
    const fetchMock = vi.fn(() => json({ data: order }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTrackOrder("", null));

    await act(() => result.current.submit());
    expect(result.current.errors.number).toBe(ar.storefront.track.numberError);
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      result.current.setNumber("#12");
      result.current.setPhone("01012345678");
    });
    await act(() => result.current.submit());
    expect(result.current.state).toEqual({ kind: "found", order });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ order_number: 12, phone: "01012345678" });

    act(() => result.current.reset());
    expect(result.current.state.kind).toBe("idle");
  });
});

describe("useSignIn", () => {
  it("sends the code to a valid phone, keeps the code to six digits, then signs in and goes back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => (String(url).endsWith("/code") ? json({ data: { channel: "screen", expires_in: 300, resend_in: 60, code: "123456" } }) : json({ data: { customer: { name: "سارة" } } }))),
    );
    const { result } = renderHook(() => useSignIn("/checkout"), { wrapper: withQuery });

    await act(() => result.current.request());
    expect(result.current.error).toBe(ar.storefront.checkout.errors.phone);

    act(() => result.current.setPhone("01012345678"));
    await act(() => result.current.request());
    expect(result.current.step).toBe("code");
    expect(result.current.shown).toBe("123456");
    expect(result.current.wait).toBe(60);

    act(() => result.current.setCode("12a34"));
    expect(result.current.code).toBe("1234");
    await act(() => result.current.verify());
    expect(result.current.error).toBe(ar.storefront.account.codeError);

    act(() => result.current.setCode("123456"));
    await act(() => result.current.verify());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/checkout"));
  });
});
