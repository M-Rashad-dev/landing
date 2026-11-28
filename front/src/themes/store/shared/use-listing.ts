"use client";

import { useRouter } from "next/navigation";
import { decodeSpec, specParams, toggleSpecValue } from "@/lib/store/spec-filter";

/**
 * What the visitor chose (search, sort, filters); the page and the category stay in the path. `spec` is the chosen
 * spec filters (canonical JSON from lib/store/spec-filter), written in the link as `spec[label]=value`.
 */
export type ListFilters = { q?: string; sort?: string; min?: string; max?: string; in_stock?: "1"; spec?: string; page?: string };

export const LIST_SORTS = ["newest", "featured", "best_sellers", "price_asc", "price_desc"] as const;

const query = (filters: ListFilters) => {
  const { spec, ...rest } = filters;
  return new URLSearchParams([...(Object.entries(rest).filter(([, v]) => v) as Array<[string, string]>), ...specParams(spec)]).toString();
};

/**
 * A product list's search, sort, price and stock filters and pages, kept in the link (so they can
 * be shared and go back with the browser). Any change of the filters goes back to page 1.
 */
export function useListing(filters: ListFilters, basePath: string) {
  const router = useRouter();

  const go = (patch: ListFilters) => {
    const next: ListFilters = { ...filters, ...patch };
    delete next.page;
    const qs = query(next);
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  return {
    filtered: Boolean(filters.q || filters.min || filters.max || filters.in_stock || filters.spec),
    /** The chosen spec filters: label → values. */
    spec: decodeSpec(filters.spec),
    /** The link of a page of the same list. */
    pageHref: (page: number) => {
      const qs = query({ ...filters, page: page > 1 ? String(page) : undefined });
      return qs ? `${basePath}?${qs}` : basePath;
    },
    search: (q: string) => go({ q: q.trim().slice(0, 60) || undefined }),
    sort: (sort: string) => go({ sort: sort === "newest" ? undefined : sort }),
    /** Whole pounds only (up to 7 digits); anything else clears that end. */
    price: (min: string, max: string) => {
      const clean = (v: string) => (/^\d{1,7}$/.test(v.trim()) ? v.trim() : undefined);
      go({ min: clean(min), max: clean(max) });
    },
    inStock: (on: boolean) => go({ in_stock: on ? "1" : undefined }),
    /** One value of a spec filter on or off. */
    specValue: (label: string, value: string, on: boolean) => go({ spec: toggleSpecValue(filters.spec, label, value, on) }),
    /** Clears the spec filters only. */
    clearSpec: () => go({ spec: undefined }),
    /** Back to the whole list (no search, no filters). */
    clear: () => router.push(basePath),
  };
}
