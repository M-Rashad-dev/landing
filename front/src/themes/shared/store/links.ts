import type { StoreCategory, StoreProductCard } from "@/themes/types";

/** Store paths on the tenant host (mirror of the reserved store slugs in back config). */
export const storePaths = {
  home: "/",
  products: "/products",
  cart: "/cart",
  checkout: "/checkout",
  product: (slug: string) => `/products/${encodeURIComponent(slug)}`,
  category: (slug: string) => `/categories/${encodeURIComponent(slug)}`,
  page: (slug: string) => `/pages/${encodeURIComponent(slug)}`,
};

export function productHref(product: Pick<StoreProductCard, "slug">): string | null {
  return product.slug ? storePaths.product(product.slug) : null;
}

/** The category and every category under it (by parent links). */
export function descendantIds(categories: StoreCategory[], id: number): Set<number> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parent_id !== null && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}
