import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import { formToPayload, productSchema, productToForm } from "./form";

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

    expect(payload).toEqual({
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
});
