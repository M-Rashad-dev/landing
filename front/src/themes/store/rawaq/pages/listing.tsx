"use client";

import { ChevronLeft, ChevronRight, ImageOff, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import * as React from "react";
import type { ProductList } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { StoreLink } from "@/themes/store/shared/context";
import { LIST_SORTS, useListing, type ListFilters } from "@/themes/store/shared/use-listing";
import { RawaqCard } from "../card";
import { useRawaqListing } from "../root";

const t = ar.storefront.list;
const ts = ar.rawaqStore;

/**
 * «رواق»'s category, all-products and offers pages, as the merchant set them in «صفحات الأقسام»:
 * the category's banner, its sub-categories as round pictures or chips, the filters shown, behind a
 * button or hidden, and the number of products in a row. The cards follow «كارد المنتج».
 */
export function RawaqListing({
  title,
  description,
  breadcrumb,
  subcategories = [],
  image = null,
  list,
  filters,
  basePath,
  kind = "list",
}: {
  title: string;
  description?: string | null;
  breadcrumb: Array<{ name: string; href?: string }>;
  subcategories?: Array<{ name: string; slug: string; image?: MediaUrls | null }>;
  image?: MediaUrls | null;
  list: ProductList;
  filters: ListFilters;
  basePath: string;
  kind?: "list" | "offers";
}) {
  const look = useRawaqListing();
  const browse = useListing(filters, basePath);
  const [open, setOpen] = React.useState(look.filters === "open");
  const banner = look.banner ? pick(image, "large") : null;
  const { meta } = list;
  const cols = { "--cols": look.columns_mobile, "--cols-wide": look.columns_desktop } as React.CSSProperties;

  const filterBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        browse.price(String(form.get("min") ?? ""), String(form.get("max") ?? ""));
      }}
      className="rq-card flex flex-wrap items-end gap-3 p-4"
    >
      <label className="as-sm flex flex-col gap-1 font-bold">
        {t.min}
        <input name="min" inputMode="numeric" defaultValue={filters.min ?? ""} className="as-base h-11 w-28 rounded-2xl border-2 bg-(--as-bg) px-3" />
      </label>
      <label className="as-sm flex flex-col gap-1 font-bold">
        {t.max}
        <input name="max" inputMode="numeric" defaultValue={filters.max ?? ""} className="as-base h-11 w-28 rounded-2xl border-2 bg-(--as-bg) px-3" />
      </label>
      <button type="submit" className="rq-btn rq-btn-main as-sm h-11">
        {t.apply}
      </button>
      <label className="as-sm flex h-11 items-center gap-2 font-bold">
        <input type="checkbox" checked={filters.in_stock === "1"} onChange={(e) => browse.inStock(e.target.checked)} className="size-4 accent-(--as-primary)" />
        {t.inStock}
      </label>
      {browse.filtered ? (
        <button type="button" onClick={browse.clear} className="as-sm ms-auto h-11 font-extrabold text-(--as-primary) hover:underline">
          {t.clear}
        </button>
      ) : null}
    </form>
  );

  return (
    <div className="flex flex-col">
      <header className={cn("relative overflow-hidden", banner ? "text-white" : "rq-sand")}>
        {banner ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- the category's own picture from the media server */}
            <img src={banner} alt="" className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/25" aria-hidden />
          </>
        ) : null}
        <div className="rq-wrap relative flex flex-col gap-3 py-10 @3xl:py-16">
          <nav className={cn("as-sm flex flex-wrap items-center gap-1.5", banner ? "text-white/80" : "as-muted")} aria-label={ar.storefront.breadcrumb}>
            <StoreLink href="/" className="hover:underline">
              {ar.storefront.home}
            </StoreLink>
            {breadcrumb.map((c, i) => (
              <React.Fragment key={i}>
                <ChevronLeft className="size-3.5" aria-hidden />
                {c.href ? (
                  <StoreLink href={c.href} className="hover:underline">
                    {c.name}
                  </StoreLink>
                ) : (
                  <span className="font-bold">{c.name}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
          <h1 className="rq-display rq-title">{filters.q ? t.searchTitle(filters.q) : title}</h1>
          {description ? <p className={cn("as-base max-w-2xl whitespace-pre-line", banner ? "text-white/85" : "as-muted")}>{description}</p> : null}
          <p className={cn("as-sm font-bold", banner ? "text-white/85" : "as-muted")}>{t.count(meta.total)}</p>
        </div>
      </header>

      <div className="rq-wrap flex flex-col gap-6 py-8">
        {subcategories.length ? (
          look.subcategories === "circles" ? (
            <ul className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label={t.subcategories}>
              {subcategories.map((c) => (
                <li key={c.slug} className="w-24 shrink-0 @3xl:w-28">
                  <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="group flex flex-col items-center gap-2 text-center">
                    <span className="rq-tile block w-full">
                      {pick(c.image, "thumb") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- the category's own picture
                        <img src={pick(c.image, "thumb")!} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <span className="flex size-full items-center justify-center as-muted">
                          <ImageOff className="size-6" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="as-sm font-bold">{c.name}</span>
                  </StoreLink>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rq-tabs" aria-label={t.subcategories}>
              {subcategories.map((c) => (
                <StoreLink key={c.slug} href={`/categories/${encodeURIComponent(c.slug)}`} className="rq-tab as-sm">
                  {c.name}
                </StoreLink>
              ))}
            </div>
          )
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              browse.search(String(new FormData(e.currentTarget).get("q") ?? ""));
            }}
            className="min-w-0 flex-1 basis-56"
          >
            <label className="flex h-11 items-center gap-2 rounded-full border-2 bg-(--as-bg) px-4">
              <Search className="size-4 as-muted" aria-hidden />
              <input key={filters.q ?? ""} name="q" type="search" defaultValue={filters.q ?? ""} placeholder={ts.searchPlaceholder} aria-label={t.searchLabel} className="as-sm w-full bg-transparent outline-none" />
            </label>
          </form>
          <select value={filters.sort ?? "newest"} onChange={(e) => browse.sort(e.target.value)} aria-label={t.sort} className="as-sm h-11 rounded-full border-2 bg-(--as-bg) px-4 font-bold">
            {LIST_SORTS.map((s) => (
              <option key={s} value={s}>
                {t.sorts[s]}
              </option>
            ))}
          </select>
          {look.filters === "button" ? (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn("rq-btn border bg-(--rq-white) as-sm h-11", open && "border-(--as-primary) text-(--as-primary)")}>
              {open ? <X className="size-4" aria-hidden /> : <SlidersHorizontal className="size-4" aria-hidden />}
              {open ? ts.list.closeFilters : ts.list.filters}
            </button>
          ) : null}
        </div>
        {look.filters !== "hidden" && open ? filterBox : null}

        {list.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-(--rq-blush) text-(--as-primary)">
              <PackageSearch className="size-8" aria-hidden />
            </span>
            <p className="rq-display as-xl">{kind === "offers" && !browse.filtered ? t.noOffers : t.empty}</p>
            <p className="as-sm as-muted">{kind === "offers" && !browse.filtered ? t.noOffersHint : t.emptyHint}</p>
            {browse.filtered ? (
              <button type="button" onClick={browse.clear} className="rq-btn rq-btn-main as-sm h-11">
                {t.clear}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-3 @3xl:grid-cols-[repeat(var(--cols-wide),minmax(0,1fr))] @3xl:gap-5" style={cols}>
            {list.data.map((p) => (
              <li key={p.id}>
                <RawaqCard product={p} />
              </li>
            ))}
          </ul>
        )}

        {meta.last_page > 1 ? (
          <nav className="flex items-center justify-center gap-3" aria-label={t.page(meta.current_page, meta.last_page)}>
            {meta.current_page > 1 ? (
              <StoreLink href={browse.pageHref(meta.current_page - 1)} className="flex size-11 items-center justify-center rounded-full border-2 hover:border-(--as-primary)" aria-label={ar.storefront.previous}>
                <ChevronRight className="size-5" aria-hidden />
              </StoreLink>
            ) : null}
            <span className="as-sm font-bold">{t.page(meta.current_page, meta.last_page)}</span>
            {meta.current_page < meta.last_page ? (
              <StoreLink href={browse.pageHref(meta.current_page + 1)} className="flex size-11 items-center justify-center rounded-full border-2 hover:border-(--as-primary)" aria-label={ar.storefront.next}>
                <ChevronLeft className="size-5" aria-hidden />
              </StoreLink>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
