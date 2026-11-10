import { z } from "zod";
import { isHexColor } from "@/lib/color";
import type { OptionDisplayType, Product } from "@/lib/types";
import { ar } from "@/messages/ar";

const money = (message: string) => z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, message);
const optionalMoney = z.string().trim().refine((v) => v === "" || /^\d{1,7}(\.\d{1,2})?$/.test(v), ar.validation.number);
/** A value may lower the price too (fixed amount, the unit price never goes below 0). */
const signedMoney = z.string().trim().refine((v) => v === "" || /^-?\d{1,7}(\.\d{1,2})?$/.test(v), ar.validation.number);
const optionalCount = z.string().trim().refine((v) => v === "" || (/^\d{1,7}$/.test(v) && Number(v) <= 1000000), ar.validation.number);
const slugRe = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export const valueSchema = z.object({
  key: z.string(),
  id: z.number().optional(),
  label: z.string().trim().min(1, ar.validation.required).max(40, ar.validation.max(40)),
  color_hex: z.string(),
  price_delta: signedMoney,
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
    // Store fields.
    slug: z.string().trim().max(120, ar.validation.max(120)).refine((v) => v === "" || slugRe.test(v), ar.validation.slug),
    short_description: z.string().trim().max(300, ar.validation.max(300)),
    in_store: z.boolean(),
    is_featured: z.boolean(),
    category_ids: z.array(z.number()).max(20),
    stock_mode: z.enum(["unlimited", "product", "variant"]),
    stock: optionalCount,
    low_stock_threshold: optionalCount,
    /** Variant stock by combination key (see combinationKey). */
    variant_stock: z.record(z.string(), optionalCount),
    seo_title: z.string().trim().max(70, ar.validation.max(70)),
    seo_description: z.string().trim().max(170, ar.validation.max(170)),
    seo_noindex: z.boolean(),
  })
  .superRefine((product, ctx) => {
    if (product.stock_mode === "product" && product.stock.trim() === "") ctx.addIssue({ code: "custom", path: ["stock"], message: ar.validation.required });
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

export const MAX_VARIANTS = 300;

export type Combination = { key: string; values: Record<string, string>; label: string };

/**
 * Stock combinations: one per mix of the active values of the required options (the same rule
 * the server uses), keyed by option name + value label so they survive reordering and saving.
 */
export function combinations(options: Array<Pick<OptionFormValues, "name" | "is_required" | "values">>): Combination[] {
  const required = options
    .filter((o) => o.is_required && o.name.trim() !== "")
    .map((o) => ({ name: o.name.trim(), labels: o.values.filter((v) => v.is_active && v.label.trim() !== "").map((v) => v.label.trim()) }))
    .filter((o) => o.labels.length > 0);
  if (required.length === 0) return [];
  let combos: Array<Record<string, string>> = [{}];
  for (const option of required) {
    combos = combos.flatMap((combo) => option.labels.map((label) => ({ ...combo, [option.name]: label })));
    if (combos.length > MAX_VARIANTS) return combos.slice(0, MAX_VARIANTS + 1).map((values) => ({ key: combinationKey(values), values, label: Object.values(values).join(" / ") }));
  }
  return combos.map((values) => ({ key: combinationKey(values), values, label: Object.values(values).join(" / ") }));
}

export function combinationKey(values: Record<string, string>): string {
  return Object.keys(values)
    .sort()
    .map((name) => `${name.toLowerCase()}=${values[name].toLowerCase()}`)
    .join("|");
}

/** Server variants (value ids) → stock by combination key. */
function variantStock(product?: Product): Record<string, string> {
  if (!product?.variants?.length || !product.options) return {};
  const byValue = new Map<number, { option: string; label: string }>();
  for (const option of product.options) for (const value of option.values) byValue.set(value.id, { option: option.name, label: value.label });
  const out: Record<string, string> = {};
  for (const variant of product.variants) {
    const values: Record<string, string> = {};
    for (const id of variant.value_ids) {
      const v = byValue.get(id);
      if (v) values[v.option] = v.label;
    }
    if (Object.keys(values).length) out[combinationKey(values)] = String(variant.stock);
  }
  return out;
}

export function productToForm(product?: Product): ProductFormValues {
  return {
    slug: product?.slug ?? "",
    short_description: product?.short_description ?? "",
    in_store: product?.in_store ?? true,
    is_featured: product?.is_featured ?? false,
    category_ids: product?.category_ids ?? [],
    stock_mode: product?.stock_mode ?? "unlimited",
    stock: product?.stock === null || product?.stock === undefined ? "" : String(product.stock),
    low_stock_threshold: product?.low_stock_threshold === null || product?.low_stock_threshold === undefined ? "" : String(product.low_stock_threshold),
    variant_stock: variantStock(product),
    seo_title: product?.seo?.title ?? "",
    seo_description: product?.seo?.description ?? "",
    seo_noindex: Boolean(product?.seo?.noindex),
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
  // Store fields (optional: the quick product of the page wizard leaves them to their defaults).
  slug?: string | null;
  short_description?: string | null;
  in_store?: boolean;
  is_featured?: boolean;
  category_ids?: number[];
  stock_mode?: "unlimited" | "product" | "variant";
  stock?: number | null;
  low_stock_threshold?: number | null;
  variants?: Array<{ values: Record<string, string>; stock: number }>;
  seo?: { title: string | null; description: string | null; noindex: boolean } | null;
};

export function formToPayload(values: ProductFormValues): ProductPayload {
  const variants =
    values.stock_mode === "variant"
      ? combinations(values.options)
          .slice(0, MAX_VARIANTS)
          .map((combo) => ({ values: combo.values, stock: Number(values.variant_stock[combo.key] || 0) }))
      : [];
  const hasSeo = values.seo_title.trim() !== "" || values.seo_description.trim() !== "" || values.seo_noindex;
  return {
    slug: values.slug.trim() || null,
    short_description: values.short_description.trim() || null,
    in_store: values.in_store,
    is_featured: values.is_featured,
    category_ids: values.category_ids,
    stock_mode: values.stock_mode,
    stock: values.stock_mode === "product" ? Number(values.stock || 0) : null,
    low_stock_threshold: values.low_stock_threshold.trim() === "" ? null : Number(values.low_stock_threshold),
    variants,
    seo: hasSeo ? { title: values.seo_title.trim() || null, description: values.seo_description.trim() || null, noindex: values.seo_noindex } : null,
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
