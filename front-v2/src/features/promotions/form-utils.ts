import { z } from "zod";
import { isoToCairoInput } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { Target } from "./api";

const v = ar.validation;

/** Text of a number field → number, or null when empty. */
export const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

/** Adds an issue when a required whole number is missing or out of range. */
export function checkInt(ctx: z.RefinementCtx, path: string, raw: string, min: number, max: number, required = true) {
  const n = num(raw);
  if (n === null) {
    if (required) ctx.addIssue({ code: "custom", path: [path], message: v.required });
    return;
  }
  if (!Number.isInteger(n) || n < min || n > max) ctx.addIssue({ code: "custom", path: [path], message: v.between(min, max) });
}

/** Adds an issue when a required amount is missing or not above zero (or below zero when zero is allowed). */
export function checkMoney(ctx: z.RefinementCtx, path: string, raw: string, { required = true, allowZero = false } = {}) {
  const n = num(raw);
  if (n === null) {
    if (required) ctx.addIssue({ code: "custom", path: [path], message: v.required });
    return;
  }
  if (Number.isNaN(n) || n < 0 || (!allowZero && n === 0)) ctx.addIssue({ code: "custom", path: [path], message: v.positive });
}

export function checkTarget(ctx: z.RefinementCtx, values: { applies_to: Target; product_ids: number[]; category_ids: number[] }) {
  if (values.applies_to === "products" && values.product_ids.length === 0) ctx.addIssue({ code: "custom", path: ["product_ids"], message: v.pickOne });
  if (values.applies_to === "categories" && values.category_ids.length === 0) ctx.addIssue({ code: "custom", path: ["category_ids"], message: v.pickOne });
}

/** Common fields of every promotion form. */
export const baseShape = {
  applies_to: z.enum(["all", "products", "categories"]),
  product_ids: z.array(z.number()),
  category_ids: z.array(z.number()),
  starts_at: z.string(),
  ends_at: z.string(),
  is_active: z.boolean(),
};

export function baseDefaults(p?: { applies_to: Target; product_ids?: number[]; category_ids?: number[]; starts_at: string | null; ends_at: string | null; is_active: boolean } | null, target: Target = "all") {
  return {
    applies_to: p?.applies_to ?? target,
    product_ids: p?.product_ids ?? [],
    category_ids: p?.category_ids ?? [],
    starts_at: isoToCairoInput(p?.starts_at),
    ends_at: isoToCairoInput(p?.ends_at),
    is_active: p?.is_active ?? true,
  };
}

/** What the API expects for the common fields (only the list that matches the target). */
export function basePayload(values: { applies_to: Target; product_ids: number[]; category_ids: number[]; starts_at: string; ends_at: string; is_active: boolean }) {
  return {
    applies_to: values.applies_to,
    product_ids: values.applies_to === "products" ? values.product_ids : [],
    category_ids: values.applies_to === "categories" ? values.category_ids : [],
    starts_at: values.starts_at || null,
    ends_at: values.ends_at || null,
    is_active: values.is_active,
  };
}

export const BASE_FIELDS = ["applies_to", "product_ids", "category_ids", "starts_at", "ends_at", "is_active"] as const;
