import { SlidersHorizontal } from "lucide-react";
import type { StoreListQuery, StoreProductList } from "@/lib/public/store";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { storePaths } from "@/themes/shared/store/links";
import { ProductCard } from "@/themes/shared/store/product-card";
import type { StoreCategory } from "@/themes/types";
import type { StoreLook } from "./look";
import { SortSelect } from "./sort-select";

const t = siteMessages.store;

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items, look }: { items: Crumb[]; look: StoreLook }) {
  return (
    <nav aria-label={t.breadcrumb} className={cn(look.muted, "mb-4 text-sm")}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {item.href ? (
              <a href={item.href} className="hover:underline">
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="t-heading font-semibold">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function pageHref(basePath: string, query: StoreListQuery, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && key !== "category" && key !== "page") params.set(key, value);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * A page of products with filters (sort, price range, in stock), sub-category chips and
 * pagination. Filters are a plain GET form, so the list is a server page with shareable URLs.
 */
export function ProductListing({
  title,
  description,
  crumbs,
  list,
  query,
  basePath,
  chips,
  look,
}: {
  title: string;
  description?: string | null;
  crumbs: Crumb[];
  list: StoreProductList;
  query: StoreListQuery;
  basePath: string;
  chips: StoreCategory[];
  look: StoreLook;
}) {
  const { meta } = list;
  const filtered = Boolean(query.q || query.min || query.max || query.in_stock || (query.sort && query.sort !== "newest"));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <Breadcrumb items={crumbs} look={look} />
      <header className="mb-6">
        <h1 className="t-heading text-2xl font-extrabold md:text-3xl">{title}</h1>
        {description ? <p className={cn(look.muted, "mt-2 max-w-2xl leading-relaxed")}>{description}</p> : null}
        <p className={cn(look.muted, "mt-2 text-sm")} data-testid="products-count">
          {t.productsCount(meta.total)}
        </p>
      </header>

      {chips.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.id}>
              <a href={storePaths.category(c.slug)} className={look.chip(false)}>
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <form method="get" action={basePath} className={cn(look.surface, "mb-8 flex flex-wrap items-end gap-3")}>
        <SlidersHorizontal className={cn(look.muted, "mb-3 hidden size-4 sm:block")} aria-hidden />
        {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
        <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold">
          {t.sort}
          <SortSelect value={query.sort ?? "newest"} className={cn(look.input, "h-11 text-sm")} />
        </label>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 text-xs font-semibold">{t.priceRange}</legend>
          <input name="min" inputMode="decimal" dir="ltr" defaultValue={query.min} placeholder={t.min} aria-label={`${t.priceRange} ${t.min}`} className={cn(look.input, "h-11 w-24 text-sm")} />
          <input name="max" inputMode="decimal" dir="ltr" defaultValue={query.max} placeholder={t.max} aria-label={`${t.priceRange} ${t.max}`} className={cn(look.input, "h-11 w-24 text-sm")} />
        </fieldset>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="in_stock" value="1" defaultChecked={query.in_stock === "1"} className="size-4 accent-[var(--c-primary)]" />
          {t.inStockOnly}
        </label>
        <div className="ms-auto flex gap-2">
          {filtered ? (
            <a href={basePath} className={look.chip(false)}>
              {t.clearFilters}
            </a>
          ) : null}
          <button type="submit" className={look.chip(true)}>
            {t.applyFilters}
          </button>
        </div>
      </form>

      {list.data.length === 0 ? (
        <div className={cn(look.surface, "flex flex-col items-center gap-2 py-16 text-center")}>
          <p className="t-heading text-lg font-bold">{t.noProducts}</p>
          <p className={look.muted}>{t.noProductsText}</p>
          {filtered ? (
            <a href={basePath} className={cn(look.chip(true), "mt-3")}>
              {t.clearFilters}
            </a>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4" data-testid="product-grid">
          {list.data.map((product, i) => (
            <li key={product.id}>
              <ProductCard product={product} look={look.block} priority={i < 4} />
            </li>
          ))}
        </ul>
      )}

      {meta.last_page > 1 ? (
        <nav aria-label={t.pageOf(meta.current_page, meta.last_page)} className="mt-10 flex items-center justify-center gap-3">
          {meta.current_page > 1 ? (
            <a href={pageHref(basePath, query, meta.current_page - 1)} className={look.chip(false)} rel="prev">
              {t.pagePrev}
            </a>
          ) : null}
          <span className={cn(look.muted, "text-sm")}>{t.pageOf(meta.current_page, meta.last_page)}</span>
          {meta.current_page < meta.last_page ? (
            <a href={pageHref(basePath, query, meta.current_page + 1)} className={look.chip(false)} rel="next">
              {t.pageNext}
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
