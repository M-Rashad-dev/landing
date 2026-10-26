import { z } from "zod";
import { isHexColor } from "@/lib/color";
import type { OptionDisplayType, Product } from "@/lib/types";
import { ar } from "@/messages/ar";

const money = (message: string) => z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, message);
const optionalMoney = z.string().trim().refine((v) => v === "" || /^\d{1,7}(\.\d{1,2})?$/.test(v), ar.validation.number);

export const valueSchema = z.object({
  key: z.string(),
  id: z.number().optional(),
  label: z.string().trim().min(1, ar.validation.required).max(40, ar.validation.max(40)),
  color_hex: z.string(),
  price_delta: optionalMoney,
  is_active: z.boolean(),
});

export const optionSchema = z
  .object({
    key: z.string(),
    id: z.number().optional(),
    name: z.string().trim().min(1, ar.validation.required).max(40, ar.validation.max(40)),
    display_type: z.enum(["buttons", "dropdown", "swatch"]),
    is_required: z.boolean(),
    values: z.array(valueSchema).min(1, ar.validation.required).max(30),
  })
  .superRefine((option, ctx) => {
    const seen = new Set<string>();
    option.values.forEach((value, index) => {
      const label = value.label.trim().toLowerCase();
      if (label && seen.has(label)) ctx.addIssue({ code: "custom", path: ["values", index, "label"], message: ar.products.duplicateValue });
      seen.add(label);
      if (option.display_type === "swatch" && !isHexColor(value.color_hex)) {
        ctx.addIssue({ code: "custom", path: ["values", index, "color_hex"], message: ar.validation.hex });
      }
    });
  });

export const productSchema = z
  .object({
    name: z.string().trim().min(1, ar.validation.required).max(150, ar.validation.max(150)),
    description: z.string().max(10000, ar.validation.max(10000)),
    sku: z.string().trim().max(60, ar.validation.max(60)),
    price: money(ar.validation.number).refine((v) => Number(v) > 0, ar.products.pricePositive),
    compare_at_price: optionalMoney,
    is_active: z.boolean(),
    media_ids: z.array(z.number()).max(10),
    options: z.array(optionSchema).max(5, ar.products.options.max),
  })
  .superRefine((product, ctx) => {
    if (product.compare_at_price.trim() !== "" && Number(product.compare_at_price) <= Number(product.price)) {
      ctx.addIssue({ code: "custom", path: ["compare_at_price"], message: ar.products.compareAtGreater });
    }
    const names = new Set<string>();
    product.options.forEach((option, index) => {
      const name = option.name.trim().toLowerCase();
      if (name && names.has(name)) ctx.addIssue({ code: "custom", path: ["options", index, "name"], message: ar.products.duplicateOption });
      names.add(name);
    });
  });

export type ProductFormValues = z.infer<typeof productSchema>;
export type OptionFormValues = z.infer<typeof optionSchema>;
export type ValueFormValues = z.infer<typeof valueSchema>;

let keyCounter = 0;
export function newKey(): string {
  keyCounter += 1;
  return `k${Date.now().toString(36)}${keyCounter}`;
}

export function newValue(label = ""): ValueFormValues {
  return { key: newKey(), label, color_hex: "", price_delta: "", is_active: true };
}

export function newOption(): OptionFormValues {
  return { key: newKey(), name: "", display_type: "buttons", is_required: true, values: [newValue()] };
}

const moneyText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

export function productToForm(product?: Product): ProductFormValues {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    sku: product?.sku ?? "",
    price: moneyText(product?.price),
    compare_at_price: moneyText(product?.compare_at_price),
    is_active: product?.is_active ?? true,
    media_ids: product?.media_ids ?? [],
    options: (product?.options ?? []).map((option) => ({
      key: newKey(),
      id: option.id,
      name: option.name,
      display_type: option.display_type,
      is_required: option.is_required,
      values: option.values.map((value) => ({
        key: newKey(),
        id: value.id,
        label: value.label,
        color_hex: value.color_hex ?? "",
        price_delta: value.price_delta ? String(value.price_delta) : "",
        is_active: value.is_active,
      })),
    })),
  };
}

export type ProductPayload = {
  name: string;
  description: string | null;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  is_active: boolean;
  media_ids: number[];
  options: Array<{
    id?: number;
    name: string;
    display_type: OptionDisplayType;
    is_required: boolean;
    values: Array<{ id?: number; label: string; color_hex: string | null; price_delta: string; is_active: boolean }>;
  }>;
};

export function formToPayload(values: ProductFormValues): ProductPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    sku: values.sku.trim() || null,
    price: values.price.trim(),
    compare_at_price: values.compare_at_price.trim() || null,
    is_active: values.is_active,
    media_ids: values.media_ids,
    options: values.options.map((option) => ({
      ...(option.id ? { id: option.id } : {}),
      name: option.name.trim(),
      display_type: option.display_type,
      is_required: option.is_required,
      values: option.values.map((value) => ({
        ...(value.id ? { id: value.id } : {}),
        label: value.label.trim(),
        color_hex: option.display_type === "swatch" && value.color_hex ? value.color_hex.toUpperCase() : null,
        price_delta: value.price_delta.trim() || "0",
        is_active: value.is_active,
      })),
    })),
  };
}
