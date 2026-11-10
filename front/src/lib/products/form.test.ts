import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import { combinationKey, combinations, formToPayload, productSchema, productToForm } from "./form";

const product: Product = {
  id: 7,
  name: "تيشيرت",
  description: "وصف",
  price: 350,
  compare_at_price: 450.5,
  discount_percent: 22,
  sku: null,
  is_active: true,
  media_ids: [3, 1],
  options: [
    {
      id: 11,
      name: "اللون",
      display_type: "swatch",
      is_required: true,
      values: [
        { id: 21, label: "أسود", color_hex: "#000000", price_delta: 0, is_active: true },
        { id: 22, label: "أحمر", color_hex: "#ff0000", price_delta: 15.5, is_active: false },
      ],
    },
  ],
  created_at: null,
  updated_at: null,
};

describe("product form transforms", () => {
  it("round-trips nested options keeping ids and order", () => {
    const payload = formToPayload(productToForm(product));

    expect(payload).toMatchObject({
      name: "تيشيرت",
      description: "وصف",
      sku: null,
      price: "350",
      compare_at_price: "450.5",
      is_active: true,
      media_ids: [3, 1],
      options: [
        {
          id: 11,
          name: "اللون",
          display_type: "swatch",
          is_required: true,
          values: [
            { id: 21, label: "أسود", color_hex: "#000000", price_delta: "0", is_active: true },
            { id: 22, label: "أحمر", color_hex: "#FF0000", price_delta: "15.5", is_active: false },
          ],
        },
      ],
    });
  });

  it("omits ids for new items and colors for non-swatch options", () => {
    const values = productToForm();
    values.name = "جديد";
    values.price = "10";
    values.options = [{ key: "a", name: "المقاس", display_type: "buttons", is_required: false, values: [{ key: "b", label: "S", color_hex: "#123456", price_delta: "", is_active: true }] }];

    const payload = formToPayload(values);
    expect(payload.options[0]).not.toHaveProperty("id");
    expect(payload.options[0].values[0]).toEqual({ label: "S", color_hex: null, price_delta: "0", is_active: true });
  });
});

describe("product schema", () => {
  const valid = () => productToForm(product);

  it("accepts a valid product", () => {
    expect(productSchema.safeParse(valid()).success).toBe(true);
  });

  it("requires compare-at above price", () => {
    const values = { ...valid(), compare_at_price: "300" };
    const result = productSchema.safeParse(values);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["compare_at_price"]);
  });

  it("flags duplicate values and missing swatch colors with nested paths", () => {
    const values = valid();
    values.options[0].values[1].label = "أسود";
    values.options[0].values[0].color_hex = "";
    const paths = productSchema.safeParse(values).error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["options.0.values.1.label", "options.0.values.0.color_hex"]));
  });

  it("rejects prices with more than two decimals", () => {
    expect(productSchema.safeParse({ ...valid(), price: "10.999" }).success).toBe(false);
  });

  it("accepts option values that lower the price", () => {
    const values = valid();
    values.options[0].values[0].price_delta = "-20";
    expect(productSchema.safeParse(values).success).toBe(true);
    values.options[0].values[0].price_delta = "--2";
    expect(productSchema.safeParse(values).success).toBe(false);
  });

  it("needs a quantity when the product tracks one stock", () => {
    const result = productSchema.safeParse({ ...valid(), stock_mode: "product", stock: "" });
    expect(result.error?.issues.map((i) => i.path.join("."))).toContain("stock");
  });

  it("rejects store slugs with spaces", () => {
    expect(productSchema.safeParse({ ...valid(), slug: "تيشيرت قطن" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid(), slug: "تيشيرت-قطن" }).success).toBe(true);
  });
});

describe("store fields", () => {
  it("defaults a new product to the store, unlimited stock", () => {
    const values = productToForm();
    expect(values).toMatchObject({ in_store: true, is_featured: false, stock_mode: "unlimited", category_ids: [] });
  });

  it("builds stock combinations from the active values of required options only", () => {
    const combos = combinations([
      { name: "المقاس", is_required: true, values: [{ key: "1", label: "M", color_hex: "", price_delta: "", is_active: true }, { key: "2", label: "L", color_hex: "", price_delta: "", is_active: true }, { key: "3", label: "XL", color_hex: "", price_delta: "", is_active: false }] },
      { name: "اللون", is_required: true, values: [{ key: "4", label: "أسود", color_hex: "", price_delta: "", is_active: true }] },
      { name: "تغليف", is_required: false, values: [{ key: "5", label: "هدية", color_hex: "", price_delta: "", is_active: true }] },
    ]);
    expect(combos.map((c) => c.label)).toEqual(["M / أسود", "L / أسود"]);
    expect(combos[0].key).toBe(combinationKey({ اللون: "أسود", المقاس: "M" }));
  });

  it("round-trips variant stock through the server shape (value ids → labels)", () => {
    const withVariants: Product = { ...product, stock_mode: "variant", variants: [{ id: 1, value_ids: [21], stock: 4, sku: null }] };
    const values = productToForm(withVariants);
    expect(values.variant_stock[combinationKey({ اللون: "أسود" })]).toBe("4");
    const payload = formToPayload(values);
    expect(payload.variants).toEqual([{ values: { اللون: "أسود" }, stock: 4 }]);
    expect(payload.stock).toBeNull();
  });

  it("sends SEO only when something is set", () => {
    expect(formToPayload(productToForm(product)).seo).toBeNull();
    expect(formToPayload({ ...productToForm(product), seo_title: "عنوان" }).seo).toEqual({ title: "عنوان", description: null, noindex: false });
  });
});
