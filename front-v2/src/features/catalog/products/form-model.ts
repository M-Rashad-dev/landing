import { z } from "zod";
import type { MediaItem } from "@/features/media/api";
import { SLUG_PATTERN } from "@/lib/slug";
import { zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { cleanSeo, type SeoValue } from "../seo/seo-model";
import type { DisplayType, ProductDetail, StockMode } from "./api";

const v = ar.validation;
const money = (signed = false) => (signed ? /^-?\d{0,7}(\.\d{1,2})?$/ : /^\d{0,7}(\.\d{1,2})?$/);

const optionValue = z.object({
  id: z.number().nullable(),
  label: zRequiredString(40),
  color_hex: z.string(),
  price_delta: z.string().refine((s) => s === "" || s === "-" || money(true).test(s), v.required),
  is_active: z.boolean(),
});

const option = z.object({
  id: z.number().nullable(),
  name: zRequiredString(40),
  display_type: z.enum(["buttons", "dropdown", "swatch"]),
  is_required: z.boolean(),
  values: z.array(optionValue).min(1).max(30),
});

export const productSchema = z
  .object({
    name: zRequiredString(150),
    short_description: z.string().max(300),
    description: z.string().max(10000),
    price: z.string().refine((s) => money().test(s) && Number(s) > 0, v.required),
    compare_at_price: z.string().refine((s) => s === "" || money().test(s), v.required),
    sku: z.string().max(60),
    media: z.array(z.custom<MediaItem>()).max(10),
    category_ids: z.array(z.number()).max(20),
    primary_category_id: z.number().nullable(),
    options: z.array(option).max(5),
    stock_mode: z.enum(["unlimited", "product", "variant"]),
    stock: z.string(),
    low_stock_threshold: z.string().refine((s) => s === "" || /^\d{1,7}$/.test(s), v.required),
    variant_stock: z.record(z.string(), z.string()),
    is_active: z.boolean(),
    in_store: z.boolean(),
    is_featured: z.boolean(),
    slug: z
      .string()
      .trim()
      .max(120)
      .refine((s) => s === "" || SLUG_PATTERN.test(s), ar.catalog.seo.slugInvalid),
    seo: z.custom<SeoValue>(),
  })
  .superRefine((val, ctx) => {
    if (val.compare_at_price && Number(val.compare_at_price) > 0 && Number(val.compare_at_price) <= Number(val.price)) {
      ctx.addIssue({ code: "custom", path: ["compare_at_price"], message: ar.catalog.form.compareAtLower });
    }
    if (val.stock_mode === "product" && !/^\d{1,7}$/.test(val.stock)) {
      ctx.addIssue({ code: "custom", path: ["stock"], message: v.required });
    }
  });

export type ProductValues = z.infer<typeof productSchema>;
export type OptionValues = ProductValues["options"][number];

export const EMPTY: ProductValues = {
  name: "",
  short_description: "",
  description: "",
  price: "",
  compare_at_price: "",
  sku: "",
  media: [],
  category_ids: [],
  primary_category_id: null,
  options: [],
  stock_mode: "unlimited",
  stock: "",
  low_stock_threshold: "",
  variant_stock: {},
  is_active: true,
  in_store: true,
  is_featured: false,
  slug: "",
  seo: {},
};

const SEP = "\u001F";

/** The options that make stock combinations: required, with their available values. */
export function stockOptions(options: OptionValues[]): Array<{ name: string; labels: string[] }> {
  return options
    .filter((o) => o.is_required && o.name.trim())
    .map((o) => ({ name: o.name.trim(), labels: o.values.filter((x) => x.is_active && x.label.trim()).map((x) => x.label.trim()) }))
    .filter((o) => o.labels.length > 0);
}

/** Every combination ("أحمر / XL") with its key in variant_stock. */
export function combinations(options: OptionValues[]): Array<{ key: string; labels: string[] }> {
  const dims = stockOptions(options);
  if (dims.length === 0) return [];
  let out: string[][] = [[]];
  for (const d of dims) out = out.flatMap((prefix) => d.labels.map((l) => [...prefix, l]));
  return out.map((labels) => ({ key: labels.join(SEP), labels }));
}

/** Form values from the saved product. */
export function fromDetail(p: ProductDetail): ProductValues {
  const options: OptionValues[] = p.options.map((o) => ({
    id: o.id,
    name: o.name,
    display_type: o.display_type,
    is_required: o.is_required,
    values: o.values.map((x) => ({ id: x.id, label: x.label, color_hex: x.color_hex ?? "", price_delta: x.price_delta ? String(x.price_delta) : "", is_active: x.is_active })),
  }));
  const labelOf = new Map(p.options.flatMap((o) => o.values.map((x) => [x.id, x.label] as const)));
  const required = p.options.filter((o) => o.is_required);
  const variant_stock: Record<string, string> = {};
  for (const variant of p.variants) {
    const labels = required.map((o) => o.values.find((x) => variant.value_ids.includes(x.id))?.id).map((id) => (id ? labelOf.get(id) : undefined));
    if (labels.every(Boolean)) variant_stock[labels.join(SEP)] = String(variant.stock);
  }

  return {
    name: p.name,
    short_description: p.short_description ?? "",
    description: p.description ?? "",
    price: String(p.price),
    compare_at_price: p.compare_at_price ? String(p.compare_at_price) : "",
    sku: p.sku ?? "",
    media: p.media,
    category_ids: p.category_ids,
    primary_category_id: p.primary_category_id,
    options,
    stock_mode: p.stock_mode,
    stock: p.stock_mode === "product" ? String(p.stock ?? 0) : "",
    low_stock_threshold: p.low_stock_threshold === null ? "" : String(p.low_stock_threshold),
    variant_stock,
    is_active: p.is_active,
    in_store: p.in_store,
    is_featured: p.is_featured,
    slug: p.slug ?? "",
    seo: p.seo ?? {},
  };
}

/** Request body for POST / PUT /dashboard/products. */
export function toPayload(v: ProductValues) {
  const mode: StockMode = v.stock_mode;
  return {
    name: v.name.trim(),
    short_description: v.short_description.trim() || null,
    description: v.description.trim() || null,
    price: v.price,
    compare_at_price: v.compare_at_price || null,
    sku: v.sku.trim() || null,
    is_active: v.is_active,
    in_store: v.in_store,
    is_featured: v.is_featured,
    slug: v.slug.trim() || null,
    seo: cleanSeo(v.seo),
    category_ids: v.category_ids,
    primary_category_id: v.primary_category_id,
    media_ids: v.media.map((m) => m.id),
    options: v.options.map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      name: o.name.trim(),
      display_type: o.display_type as DisplayType,
      is_required: o.is_required,
      values: o.values.map((x) => ({
        ...(x.id ? { id: x.id } : {}),
        label: x.label.trim(),
        color_hex: o.display_type === "swatch" && x.color_hex ? x.color_hex.toUpperCase() : null,
        price_delta: x.price_delta && x.price_delta !== "-" ? x.price_delta : "0",
        is_active: x.is_active,
      })),
    })),
    stock_mode: mode,
    stock: mode === "product" ? Number(v.stock) : null,
    low_stock_threshold: v.low_stock_threshold === "" ? null : Number(v.low_stock_threshold),
    ...(mode === "variant"
      ? {
          variants: combinations(v.options).map((c) => ({
            values: Object.fromEntries(stockOptions(v.options).map((d, i) => [d.name, c.labels[i]])),
            stock: Number(v.variant_stock[c.key] || 0),
          })),
        }
      : {}),
  };
}
