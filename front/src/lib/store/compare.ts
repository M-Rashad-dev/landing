"use client";

import type { ProductCard } from "@/themes/store/shared/types";
import { idList, useIdsFetch } from "./id-list";

/** «قارن»: up to 4 products picked by the visitor, in their browser (docs/plans/tekno/PLAN.md §2.2). */
export const MAX_COMPARE = 4;

export const compareList = idList("as_compare_v1", MAX_COMPARE);

/** A spec row of the compared products: its label, the table it came from, and each product's value (null: none). */
export type CompareRow = { label: string; group: string; values: Record<string, string | null> };
export type CompareData = { products: ProductCard[]; rows: CompareRow[] };

export function useCompare() {
  const ids = compareList.use();
  return {
    ids,
    count: ids.length,
    full: ids.length >= MAX_COMPARE,
    has: (id: number) => ids.includes(id),
    add: compareList.add,
    remove: compareList.remove,
    toggle: compareList.toggle,
    clear: compareList.clear,
  };
}

/** The compared products with their rows side by side (from the server). */
export function useCompareData(ids: number[]) {
  return useIdsFetch<CompareData>("/api/public/store/compare", ids);
}
