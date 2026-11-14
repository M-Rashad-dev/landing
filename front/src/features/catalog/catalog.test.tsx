import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagInput } from "@/components/forms/tag-input";
import { TooltipProvider } from "@/components/ui/overlay";
import { slugify } from "@/lib/slug";
import { ar } from "@/messages/ar";
import type { Category } from "./categories/api";
import { CategoryChecklist } from "./categories/category-checklist";
import { DeleteCategoryDialog } from "./categories/delete-category";
import type { ProductDetail } from "./products/api";
import { stockState } from "./products/api";
import { combinations, EMPTY, fromDetail, toPayload } from "./products/form-model";
import { autoCategorySeo, autoProductSeo, cleanSeo, plainText } from "./seo/seo-model";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

const cat = (id: number, name: string, parent: number | null = null, depth = 0): Category => ({
  id,
  parent_id: parent,
  depth,
  name,
  slug: name,
  description: null,
  media_id: null,
  image: null,
  is_visible: true,
  seo: null,
  position: id,
  products_count: 0,
  locked_by_plan: false,
  seo_defaults: { title: "", description: "", keywords: [] },
});

describe("slugify (mirror of the back end)", () => {
  it("keeps Arabic and Latin, joins words with dashes", () => {
    expect(slugify("تيشيرت قطن 100%")).toBe("تيشيرت-قطن-100");
    expect(slugify("  Cotton T-Shirt!! ")).toBe("cotton-t-shirt");
    expect(slugify("!")).toBe("");
  });
});

describe("automatic SEO (mirror of App\\Store\\SeoDefaults)", () => {
  it("builds title, description and keywords from the product", () => {
    const seo = autoProductSeo({ name: "بن برازيلي", shortDescription: "", description: "**محمص طازة**\n- 250 جرام", price: 180, categories: ["بن", "عروض"] }, "بيت القهوة");
    expect(seo).toEqual({ title: "بن برازيلي | بيت القهوة", description: "محمص طازة 250 جرام", keywords: ["بن برازيلي", "بن", "عروض", "بيت القهوة"] });
  });

  it("falls back to a sentence with the price, and categories take their parents as keywords", () => {
    expect(autoProductSeo({ name: "شنطة", shortDescription: "", description: "", price: 1250.5, categories: [] }, "سوق").description).toBe(ar.catalog.seo.productSentence("شنطة", "1,250.50", "سوق"));
    expect(autoCategorySeo({ name: "قمصان", description: "", ancestors: ["رجالي", "ملابس"] }, "سوق").keywords).toEqual(["قمصان", "رجالي", "ملابس", "سوق"]);
  });

  it("strips Markdown and leaves empty fields out of the request", () => {
    expect(plainText("## عنوان\n[رابط](https://x.y) و `كود`")).toBe("عنوان رابط و كود");
    expect(cleanSeo({ title: "  ", description: "وصف", keywords: [] })).toEqual({ description: "وصف" });
    expect(cleanSeo({})).toBeNull();
  });
});

describe("product form model", () => {
  const options = [
    { id: 1, name: "المقاس", display_type: "buttons" as const, is_required: true, values: [{ id: 11, label: "S", color_hex: "", price_delta: "", is_active: true }, { id: 12, label: "XL", color_hex: "", price_delta: "25", is_active: true }, { id: 13, label: "XXL", color_hex: "", price_delta: "", is_active: false }] },
    { id: 2, name: "اللون", display_type: "swatch" as const, is_required: true, values: [{ id: 21, label: "أسود", color_hex: "#000000", price_delta: "-10", is_active: true }] },
    { id: 3, name: "تغليف", display_type: "dropdown" as const, is_required: false, values: [{ id: 31, label: "هدية", color_hex: "", price_delta: "15", is_active: true }] },
  ];

  it("builds stock combinations from required options and available values only", () => {
    expect(combinations(options).map((c) => c.labels)).toEqual([
      ["S", "أسود"],
      ["XL", "أسود"],
    ]);
  });

  it("sends variant stock by option name, colors only for swatches, and the main category", () => {
    const keys = combinations(options).map((c) => c.key);
    const body = toPayload({ ...EMPTY, name: " قميص ", price: "300", options, stock_mode: "variant", variant_stock: { [keys[0]]: "4" }, category_ids: [5, 7], primary_category_id: 7 });
    expect(body.name).toBe("قميص");
    expect(body.primary_category_id).toBe(7);
    expect(body.stock).toBeNull();
    expect(body.variants).toEqual([
      { values: { المقاس: "S", اللون: "أسود" }, stock: 4 },
      { values: { المقاس: "XL", اللون: "أسود" }, stock: 0 },
    ]);
    expect(body.options[0].values[0]).toEqual({ id: 11, label: "S", color_hex: null, price_delta: "0", is_active: true });
    expect(body.options[1].values[0].color_hex).toBe("#000000");
  });

  it("reads saved variant stock back into the form", () => {
    const detail = {
      id: 1, name: "قميص", price: 300, compare_at_price: null, discount_percent: null, sku: null, is_active: true, slug: "قميص", in_store: true, is_featured: false,
      stock_mode: "variant", stock: null, stock_total: 9, low_stock_threshold: null, locked_by_plan: false, main_image: null, categories: [], category_ids: [], primary_category_id: null,
      description: null, short_description: null, seo: null, seo_defaults: { title: "", description: "", keywords: [] }, media: [],
      options: options.map((o) => ({ ...o, values: o.values.map((x) => ({ ...x, color_hex: x.color_hex || null, price_delta: Number(x.price_delta || 0) })) })),
      variants: [{ id: 1, value_ids: [12, 21], stock: 9, sku: null }],
    } as unknown as ProductDetail;
    const values = fromDetail(detail);
    const xl = combinations(values.options).find((c) => c.labels[0] === "XL")!;
    expect(values.variant_stock[xl.key]).toBe("9");
  });

  it("tells the card stock state", () => {
    expect(stockState({ stock_mode: "unlimited", stock_total: null, low_stock_threshold: null })).toBe("untracked");
    expect(stockState({ stock_mode: "product", stock_total: 0, low_stock_threshold: null })).toBe("out");
    expect(stockState({ stock_mode: "variant", stock_total: 4, low_stock_threshold: null })).toBe("low");
    expect(stockState({ stock_mode: "product", stock_total: 8, low_stock_threshold: 10 })).toBe("low");
    expect(stockState({ stock_mode: "product", stock_total: 30, low_stock_threshold: null })).toBe("ok");
  });
});

describe("TagInput", () => {
  it("adds on Enter or comma, ignores duplicates, removes with its button", async () => {
    function Harness() {
      const [v, setV] = React.useState<string[]>([]);
      return <TagInput value={v} onChange={setV} removeLabel={(w) => `remove ${w}`} id="tags" />;
    }
    const user = userEvent.setup();
    render(<Harness />);
    const input = document.getElementById("tags")!;
    await user.type(input, "قهوة{Enter}بن،قهوة,");
    expect(screen.getByText("قهوة")).toBeInTheDocument();
    expect(screen.getByText("بن")).toBeInTheDocument();
    expect(screen.getAllByText("قهوة")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "remove بن" }));
    expect(screen.queryByText("بن")).toBeNull();
  });
});

describe("CategoryChecklist", () => {
  it("makes the first pick the main one, moves it on unpick, and stars another on request", async () => {
    const onChange = vi.fn();
    const list = [cat(1, "رجالي"), cat(2, "قمصان", 1, 1), cat(3, "عروض")];
    const { rerender } = wrap(<CategoryChecklist categories={list} value={[]} primary={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("option", { name: /قمصان/ }));
    expect(onChange).toHaveBeenLastCalledWith([2], 2);

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <CategoryChecklist categories={list} value={[2, 3]} primary={2} onChange={onChange} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: ar.catalog.products.card.makePrimary }));
    expect(onChange).toHaveBeenLastCalledWith([2, 3], 3);
    fireEvent.click(screen.getByRole("option", { name: /قمصان/ }));
    expect(onChange).toHaveBeenLastCalledWith([3], 3);
  });
});

describe("DeleteCategoryDialog", () => {
  const list = [cat(1, "ملابس"), cat(2, "رجالي", 1, 1), cat(3, "قمصان", 2, 2), cat(4, "عروض")];

  it("asks what to do with sub-categories and sends the choice", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const onClose = vi.fn();
    wrap(<DeleteCategoryDialog category={list[0]} categories={list} onClose={onClose} />);
    expect(screen.getByText(ar.catalog.categories.deleteDialog.deleteAllHint(2))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(ar.catalog.categories.deleteDialog.deleteAll) }));
    fireEvent.click(screen.getByRole("button", { name: ar.catalog.categories.deleteDialog.confirm }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/bff/dashboard/categories/1?children=delete");
  });

  it("does not ask when there is nothing under the category", () => {
    wrap(<DeleteCategoryDialog category={list[3]} categories={list} onClose={() => undefined} />);
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
