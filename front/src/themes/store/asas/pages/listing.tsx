"use client";

import { ChevronLeft, ChevronRight, PackageSearch, Search, SlidersHorizontal, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ProductList } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink } from "../context";
import { Breadcrumb, Container, Empty, inputClass } from "../parts";
import { ProductCard } from "../product-card";

const t = ar.storefront.list;
const SORTS = ["newest", "featured", "best_sellers", "price_asc", "price_desc"] as const;

/** What the visitor chose (search, sort, filters); the page and the category stay in the path. */
export type ListFilters = { q?: string; sort?: string; min?: string; max?: string; in_stock?: "1"; page?: string };

export function Listing({
  title,
  description,
  breadcrumb,
  subcategories = [],
  list,
  filters,
  basePath,
  kind = "list",
}: {
  title: string;
  description?: string | null;
  breadcrumb: Array<{ name: string; href?: string }>;
  subcategories?: Array<{ name: string; slug: string }>;
  list: ProductList;
  filters: ListFilters;
  basePath: string;
  kind?: "list" | "offers";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(Boolean(filters.min || filters.max || filters.in_stock));
  const filtered = Boolean(filters.q || filters.min || filters.max || filters.in_stock);

  /** Any change of the filters goes back to page 1. */
  const go = (patch: ListFilters, keepPage = false) => {
    const next: ListFilters = { ...filters, ...patch };
    if (!keepPage) delete next.page;
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as Array<[string, string]>);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };
  const href = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...filters, page: page > 1 ? String(page) : undefined }).filter(([, v]) => v) as Array<[string, string]>);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const onPrice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const clean = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{1,7}$/.test(v.trim()) ? v.trim() : undefined);
    go({ min: clean(form.get("min")), max: clean(form.get("max")) });
  };
  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim().slice(0, 60);
    go({ q: q || undefined });
  };

  const { meta } = list;

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={breadcrumb} />
      <div className="flex flex-col gap-1">
        <h1 className="as-2xl font-extrabold">{filters.q ? t.searchTitle(filters.q) : title}</h1>
        {description ? <p className="as-sm as-muted max-w-2xl whitespace-pre-line">{description}</p> : null}
      </div>

      {subcategories.length ? (
        <div className="as-scroll -mx-4 flex gap-2 overflow-x-auto px-4" aria-label={t.subcategories}>
          {subcategories.map((c) => (
            <StoreLink key={c.slug} href={`/categories/${encodeURIComponent(c.slug)}`} className="as-sm shrink-0 rounded-full border px-4 py-2 font-semibold hover:bg-(--as-soft)">
              {c.name}
            </StoreLink>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-y py-3">
        <div className="flex flex-wrap items-center gap-2">
          <form role="search" onSubmit={onSearch} className="min-w-0 flex-1 basis-56">
            <label className="flex h-10 items-center gap-2 rounded-full border bg-(--as-card) px-3">
              <Search className="size-4 as-muted" aria-hidden />
              <input key={filters.q ?? ""} name="q" type="search" defaultValue={filters.q ?? ""} placeholder={ar.storefront.search} aria-label={t.searchLabel} className="as-sm w-full bg-transparent outline-none" />
            </label>
          </form>
          <label className="as-sm flex items-center gap-2">
            <span className="as-muted">{t.sort}</span>
            <select value={filters.sort ?? "newest"} onChange={(e) => go({ sort: e.target.value === "newest" ? undefined : e.target.value })} className="as-sm h-10 rounded-lg border bg-(--as-bg) px-2">
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.sorts[s]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn("as-sm flex h-10 items-center gap-1.5 rounded-lg border px-3 font-semibold", open && "bg-(--as-soft)")}>
            <SlidersHorizontal className="size-4" aria-hidden />
            {t.filters}
          </button>
        </div>
        {open ? (
          <div className="flex flex-wrap items-end gap-3">
            <form onSubmit={onPrice} className="flex flex-wrap items-end gap-2">
              <span className="as-sm pb-2.5 font-semibold">{t.price}</span>
              <label className="flex flex-col gap-1">
                <span className="as-xs as-muted">{t.min}</span>
                <input name="min" inputMode="numeric" dir="ltr" defaultValue={filters.min ?? ""} className={cn(inputClass, "h-10 w-24")} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="as-xs as-muted">{t.max}</span>
                <input name="max" inputMode="numeric" dir="ltr" defaultValue={filters.max ?? ""} className={cn(inputClass, "h-10 w-24")} />
              </label>
              <button type="submit" className="as-btn as-sm h-10">
                {t.apply}
              </button>
            </form>
            <label className="as-sm flex h-10 items-center gap-2 font-semibold">
              <input type="checkbox" checked={filters.in_stock === "1"} onChange={(e) => go({ in_stock: e.target.checked ? "1" : undefined })} className="size-4 accent-(--as-primary)" />
              {t.inStock}
            </label>
            {filtered ? (
              <button type="button" onClick={() => router.push(basePath)} className="as-sm h-10 px-2 font-semibold as-primary hover:underline">
                {t.clear}
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="as-xs as-muted">{t.count(meta.total)}</p>
      </div>

      {list.data.length === 0 ? (
        kind === "offers" && !filtered ? (
          <Empty icon={<Tag className="size-6" />} title={t.noOffers} text={t.noOffersHint} />
        ) : (
          <Empty
            icon={<PackageSearch className="size-6" />}
            title={t.empty}
            text={t.emptyHint}
            action={
              filtered ? (
                <button type="button" onClick={() => router.push(basePath)} className="as-btn as-sm">
                  {t.clear}
                </button>
              ) : null
            }
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @3xl:gap-4 @5xl:grid-cols-4">
          {list.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {meta.last_page > 1 ? (
        <nav className="flex items-center justify-center gap-2 pt-2" aria-label={t.page(meta.current_page, meta.last_page)}>
          {meta.current_page > 1 ? (
            <StoreLink href={href(meta.current_page - 1)} className="flex size-10 items-center justify-center rounded-lg border hover:bg-(--as-soft)" aria-label={ar.storefront.previous}>
              <ChevronRight className="size-4" />
            </StoreLink>
          ) : null}
          <span className="as-sm as-muted px-2">{t.page(meta.current_page, meta.last_page)}</span>
          {meta.current_page < meta.last_page ? (
            <StoreLink href={href(meta.current_page + 1)} className="flex size-10 items-center justify-center rounded-lg border hover:bg-(--as-soft)" aria-label={ar.storefront.next}>
              <ChevronLeft className="size-4" />
            </StoreLink>
          ) : null}
        </nav>
      ) : null}
    </Container>
  );
}
