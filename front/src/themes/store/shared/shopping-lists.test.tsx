import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listQuery } from "@/lib/public/store";
import { compareList, MAX_COMPARE } from "@/lib/store/compare";
import { parseIds } from "@/lib/store/id-list";
import { decodeSpec, encodeSpec, specFromSearch, specParams, toggleSpecValue } from "@/lib/store/spec-filter";
import type { ProductList } from "@/lib/store/types";
import { wishlist } from "@/lib/store/wishlist";
import { ar } from "@/messages/ar";
import { CompareView } from "../asas/pages/compare";
import { Listing } from "../asas/pages/listing";
import { WishlistView } from "../asas/pages/wishlist";
import { AsasRoot } from "../asas/root";
import type { Design } from "../asas/types";
import { SpecFilters } from "./spec-filters";
import type { DesignData, ProductCard } from "./types";

/* Stage S2 (docs/plans/tekno/PLAN.md §2): spec filters in links and panels, «قارن» and «المفضلة» in the browser. */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const settings: Design["settings"] = {
  colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" },
  font: "cairo",
  font_size: "medium",
  logo_media_id: null,
  favicon_media_id: null,
  header: { sticky: true, search: true, announcement: null },
  footer: { about: null, show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
  general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24 },
};
const data: DesignData = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [] };
const inTheme = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AsasRoot settings={settings} data={data} storeName="تيكنو" mode="live">
        {ui}
      </AsasRoot>
    </QueryClientProvider>,
  );

const card = (id: number, name: string, extra: Partial<ProductCard> = {}): ProductCard => ({ id, slug: `p-${id}`, name, short_description: null, price: 1000 * id, compare_at_price: null, discount_percent: null, image: null, available: true, needs_options: false, ...extra });
const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("spec filters in the link", () => {
  it("reads spec[label] keys into one canonical choice, and writes them back", () => {
    const json = specFromSearch({ "spec[الرامات]": ["16GB", " 8GB ", "16GB"], "spec[المعالج]": "Core i5", q: "لابتوب" });
    expect(decodeSpec(json)).toEqual({ الرامات: ["16GB", "8GB"], المعالج: ["Core i5"] });
    // The same choice in any order is the same text (one cache key).
    expect(encodeSpec({ المعالج: ["Core i5"], الرامات: ["8GB", "16GB"] })).toBe(json);
    expect(specParams(json)).toEqual([
      ["spec[الرامات]", "16GB"],
      ["spec[الرامات]", "8GB"],
      ["spec[المعالج]", "Core i5"],
    ]);
    expect(decodeSpec(toggleSpecValue(json, "الرامات", "8GB", false))).toEqual({ الرامات: ["16GB"], المعالج: ["Core i5"] });
    expect(toggleSpecValue(encodeSpec({ الرامات: ["8GB"] }), "الرامات", "8GB", false)).toBeUndefined();
    expect(specFromSearch({ "spec[]": "x", other: "y" })).toBeUndefined();
    expect(listQuery({ "spec[الرامات]": "16GB", page: "2" })).toEqual({ spec: '{"الرامات":["16GB"]}', page: "2" });
  });

  it("shows the list's spec filters, turns values on and off in the link, and clears them", () => {
    const list: ProductList = {
      data: [card(1, "لابتوب أ")],
      meta: { current_page: 1, last_page: 1, per_page: 24, total: 1, facets: [{ label: "الرامات", values: [{ value: "8GB", count: 2 }, { value: "16GB", count: 5 }] }] },
    };
    inTheme(<Listing title="لابتوبات" breadcrumb={[]} list={list} filters={{ spec: encodeSpec({ الرامات: ["16GB"] }) }} basePath="/categories/laptops" />);

    // Opened by itself: the visitor already chose a filter.
    const group = screen.getByRole("group", { name: ar.storefront.list.specs });
    expect(screen.getByRole("checkbox", { name: /16GB/ })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /8GB/ }));
    expect(decodeURIComponent(push.mock.calls[0][0])).toBe("/categories/laptops?spec[الرامات]=16GB&spec[الرامات]=8GB");

    fireEvent.click(screen.getByRole("button", { name: ar.storefront.list.specClear }));
    expect(push).toHaveBeenLastCalledWith("/categories/laptops");
    expect(group).toBeInTheDocument();
  });

  it("keeps a chosen value the list doesn't have any more, so it can be turned off; shows nothing without filters", () => {
    const toggle = vi.fn();
    const { container, rerender } = render(<SpecFilters facets={[{ label: "الرامات", values: [{ value: "8GB", count: 1 }] }]} chosen={{ الرامات: ["32GB"] }} onToggle={toggle} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /32GB/ }));
    expect(toggle).toHaveBeenCalledWith("الرامات", "32GB", false);

    rerender(<SpecFilters facets={[]} chosen={{}} onToggle={toggle} onClear={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("«قارن» and «المفضلة» lists in the browser", () => {
  it("keeps at most 4 products to compare and 100 saved, without repeats", () => {
    for (let id = 1; id <= MAX_COMPARE; id++) expect(compareList.add(id)).toBe("added");
    expect(compareList.add(9)).toBe("full");
    expect(compareList.add(2)).toBe("there");
    expect(compareList.toggle(2)).toBe("removed");
    expect(compareList.read()).toEqual([1, 3, 4]);
    expect(JSON.parse(window.localStorage.getItem("as_compare_v1") ?? "[]")).toEqual([1, 3, 4]);
    compareList.clear();
    expect(compareList.read()).toEqual([]);

    expect(parseIds("[1,1,2,-3,\"x\",4.5]", 100)).toEqual([1, 2]);
    expect(parseIds("{bad", 100)).toEqual([]);
    expect(wishlist.max).toBe(100);
  });

  it("compares the products side by side and takes one out", async () => {
    act(() => {
      compareList.add(2);
      compareList.add(1);
    });
    fetchMock.mockImplementation(() =>
      reply({
        data: {
          products: [card(2, "لابتوب ماكس"), card(1, "لابتوب إير", { available: false })],
          rows: [
            { label: "المعالج", group: "لابتوب", values: { "2": "Core i7", "1": "Core i5" } },
            { label: "البطارية", group: "لابتوب", values: { "2": "9 ساعات", "1": null } },
          ],
        },
      }),
    );
    inTheme(<CompareView />);

    expect(await screen.findByText("Core i7")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/public/store/compare?ids=2,1");
    expect(screen.getByRole("rowheader", { name: "البطارية" }).parentElement).toHaveTextContent("9 ساعات—");
    expect(screen.getByText(ar.storefront.compare.soldOut)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: ar.storefront.compare.remove("لابتوب إير") }));
    expect(compareList.read()).toEqual([2]);
  });

  it("explains an empty compare list, and offers a retry when the server fails", async () => {
    inTheme(<CompareView />);
    expect(screen.getByText(ar.storefront.compare.emptyTitle)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    cleanup();

    act(() => {
      compareList.add(5);
    });
    fetchMock.mockImplementation(() => reply({ message: "x" }, 500));
    inTheme(<CompareView />);
    expect(await screen.findByText(ar.storefront.compare.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.storefront.compare.retry })).toBeInTheDocument();
  });

  it("shows the saved products as cards and takes one out", async () => {
    act(() => {
      wishlist.add(3);
      wishlist.add(7);
    });
    fetchMock.mockImplementation(() => reply({ data: [card(3, "سماعة"), card(7, "ساعة ذكية")] }));
    inTheme(<WishlistView />);

    expect(await screen.findByText("ساعة ذكية")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/public/store/cards?ids=3,7");
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.wishlist.remove("سماعة") }));
    await waitFor(() => expect(wishlist.read()).toEqual([7]));
  });

  it("explains an empty wishlist", () => {
    inTheme(<WishlistView />);
    expect(screen.getByText(ar.storefront.wishlist.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ar.storefront.wishlist.browse })).toHaveAttribute("href", "/products");
  });
});
