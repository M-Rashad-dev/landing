"use client";

import { ImageOff, Scale, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { useCompare, useCompareData } from "@/lib/store/compare";
import { ar } from "@/messages/ar";
import { pick } from "@/themes/shared/design";
import { StoreLink } from "@/themes/store/shared/context";
import type { ProductCard } from "@/themes/store/shared/types";
import { useQuickAdd } from "@/themes/store/shared/use-quick-add";
import { Breadcrumb, Container, Empty } from "../parts";

const t = ar.storefront.compare;

/**
 * «قارن»: the visitor's products (up to 4, from their browser) side by side — picture, price, availability, then
 * every spec row; a product without a row shows «—». The default page of every store theme («تيكنو» draws its own).
 */
export function CompareView() {
  const compare = useCompare();
  const query = useCompareData(compare.ids);
  const products = query.data?.products ?? [];
  const rows = query.data?.rows ?? [];

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: t.title }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="as-2xl font-extrabold">{t.title}</h1>
          <p className="as-sm as-muted">{t.description}</p>
        </div>
        {compare.count > 0 ? (
          <button type="button" onClick={compare.clear} className="as-sm font-semibold as-primary hover:underline">
            {t.clear}
          </button>
        ) : null}
      </div>

      {compare.count === 0 ? (
        <Empty
          icon={<Scale className="size-6" />}
          title={t.emptyTitle}
          text={t.emptyText}
          action={
            <StoreLink href="/products" className="as-btn as-sm">
              {t.browse}
            </StoreLink>
          }
        />
      ) : query.failed ? (
        <Empty
          icon={<Scale className="size-6" />}
          title={t.failed}
          action={
            <button type="button" onClick={query.retry} className="as-btn as-sm">
              {t.retry}
            </button>
          }
        />
      ) : query.loading ? (
        <div className="grid gap-3 @3xl:grid-cols-4" aria-busy="true">
          {compare.ids.map((id) => (
            <div key={id} className="h-64 animate-pulse rounded-xl bg-(--as-soft)" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Empty icon={<Scale className="size-6" />} title={t.emptyTitle} text={t.emptyText} />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="as-sm w-full min-w-[36rem] border-separate border-spacing-0 overflow-hidden rounded-xl border">
            <thead>
              <tr>
                <th scope="col" className="w-36 border-b bg-(--as-soft) p-3 text-start align-bottom font-bold as-muted">
                  {t.spec}
                </th>
                {products.map((p) => (
                  <ProductHead key={p.id} product={p} onRemove={() => compare.remove(p.id)} />
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="border-b p-3 text-start font-bold as-muted">
                  {t.price}
                </th>
                {products.map((p) => (
                  <td key={p.id} className="border-b p-3 text-center">
                    <span className="font-extrabold">{formatMoney(p.price)}</span>
                    {p.compare_at_price ? <s className="as-xs ms-1.5 as-muted">{formatMoney(p.compare_at_price, { withCurrency: false })}</s> : null}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border-b p-3 text-start font-bold as-muted">
                  {t.availability}
                </th>
                {products.map((p) => (
                  <td key={p.id} className="border-b p-3 text-center font-semibold">
                    {p.available ? t.available : t.soldOut}
                  </td>
                ))}
              </tr>
              {rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "bg-(--as-soft)" : undefined}>
                  <th scope="row" className="border-b p-3 text-start font-bold as-muted">
                    {row.label}
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="border-b p-3 text-center font-semibold">
                      <bdi>{row.values[String(p.id)] ?? t.none}</bdi>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-3" />
                {products.map((p) => (
                  <td key={p.id} className="p-3 text-center">
                    <AddButton product={p} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}

function ProductHead({ product, onRemove }: { product: ProductCard; onRemove: () => void }) {
  const href = `/products/${encodeURIComponent(product.slug)}`;
  const image = pick(product.image?.urls, "thumb");
  return (
    <th scope="col" className="relative border-b p-3 align-top font-normal">
      <button type="button" onClick={onRemove} aria-label={t.remove(product.name)} className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full border bg-(--as-card) hover:bg-(--as-soft)">
        <X className="size-3.5" aria-hidden />
      </button>
      <StoreLink href={href} className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-24 items-center justify-center overflow-hidden rounded-lg bg-(--as-soft)">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-6 as-muted" aria-hidden />
          )}
        </span>
        <span className="line-clamp-2 font-bold hover:underline">{product.name}</span>
      </StoreLink>
    </th>
  );
}

function AddButton({ product }: { product: ProductCard }) {
  const quick = useQuickAdd(product);
  if (!quick.direct) {
    return (
      <StoreLink href={quick.href} className="as-btn as-sm w-full">
        {t.view}
      </StoreLink>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={quick.add} className="as-btn as-sm w-full">
        {quick.inCart > 0 ? ar.storefront.product.inCart(quick.inCart) : ar.storefront.addToCart}
      </button>
      {quick.note ? <p className="as-xs as-muted">{quick.note}</p> : null}
    </div>
  );
}
