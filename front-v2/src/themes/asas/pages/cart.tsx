"use client";

import { Gift, ImageOff, ShoppingBag, Trash2 } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { lineKey, removeFromCart, setQuantity, useCart, type Cart } from "@/lib/store/cart";
import type { QuoteState } from "@/lib/store/quote";
import { useCartQuote } from "@/lib/store/quote";
import { ar } from "@/messages/ar";
import { StoreLink } from "../context";
import { Breadcrumb, Container, Empty, QuantityStepper } from "../parts";

const t = ar.storefront.cartPage;

/** True once the browser's cart has been read (the server never knows it). */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function CartView() {
  const cart = useCart();
  const hydrated = useHydrated();
  const quote = useCartQuote(cart);

  if (!hydrated) return <Container className="min-h-[50vh] py-8">{null}</Container>;

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: t.title }]} />
      <h1 className="as-2xl font-extrabold">{t.title}</h1>
      {cart.items.length === 0 ? (
        <Empty
          icon={<ShoppingBag className="size-6" />}
          title={t.empty}
          text={t.emptyHint}
          action={
            <StoreLink href="/products" className="as-btn as-sm">
              {t.shop}
            </StoreLink>
          }
        />
      ) : (
        <div className="grid items-start gap-6 @4xl:grid-cols-[1fr_20rem]">
          <CartLines cart={cart} quote={quote} />
          <aside className="flex flex-col gap-3 rounded-2xl border bg-(--as-card) p-4 @4xl:sticky @4xl:top-24">
            <Totals quote={quote} cart={cart} />
            <p className="as-xs as-muted">{t.shippingNote}</p>
            <StoreLink href="/checkout" className="as-btn as-base w-full" aria-disabled={Object.keys(quote.lineErrors).length > 0 || undefined}>
              {t.checkout}
            </StoreLink>
            <StoreLink href="/products" className="as-sm text-center font-semibold as-primary hover:underline">
              {t.continue}
            </StoreLink>
          </aside>
        </div>
      )}
    </Container>
  );
}

/** The cart's lines with quantity and remove (the server's line problems under each line). */
export function CartLines({ cart, quote, editable = true }: { cart: Cart; quote: QuoteState; editable?: boolean }) {
  return (
    <ul className="flex flex-col divide-y rounded-2xl border">
      {cart.items.map((item, i) => {
        const key = lineKey(item);
        const line = quote.quote?.lines[i];
        return (
          <li key={key} className="flex gap-3 p-3 @3xl:p-4">
            <StoreLink href={`/products/${encodeURIComponent(item.slug)}`} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--as-soft)">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
                <img src={item.image} alt="" className="size-full object-cover" />
              ) : (
                <ImageOff className="size-6 as-muted" aria-hidden />
              )}
            </StoreLink>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <StoreLink href={`/products/${encodeURIComponent(item.slug)}`} className="as-sm line-clamp-2 font-semibold hover:underline">
                  {item.name}
                </StoreLink>
                {editable ? (
                  <button type="button" onClick={() => removeFromCart(key)} className="flex size-8 shrink-0 items-center justify-center rounded-lg as-muted hover:bg-(--as-soft) hover:text-red-600" aria-label={`${t.remove} ${item.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
              {item.options_label ? <p className="as-xs as-muted">{item.options_label}</p> : null}
              {line?.offer ? <p className="as-xs font-semibold as-primary">{line.offer.name}</p> : null}
              {line?.gift ? (
                <p className="as-xs flex items-center gap-1 font-semibold as-primary">
                  <Gift className="size-3.5" aria-hidden />
                  {t.gift(line.gift.name)}
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                {editable ? <QuantityStepper small value={item.quantity} onChange={(q) => setQuantity(key, q)} /> : <span className="as-sm as-muted">× {item.quantity}</span>}
                <span className="flex items-baseline gap-2">
                  {line && line.offer_discount > 0 ? <span className="as-xs as-muted line-through">{formatMoney(line.subtotal)}</span> : null}
                  <span className="as-base font-bold">{formatMoney(line ? line.total : item.price * item.quantity)}</span>
                </span>
              </div>
              {quote.lineErrors[i] ? (
                <p className="as-xs font-semibold text-red-600" role="alert">
                  {quote.lineErrors[i]}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Totals({ quote, cart }: { quote: QuoteState; cart: Cart }) {
  const q = quote.quote;
  const estimate = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <dl className={quote.loading ? "flex flex-col gap-2 opacity-60 transition-opacity" : "flex flex-col gap-2"} aria-busy={quote.loading}>
      <div className="as-sm flex justify-between">
        <dt className="as-muted">{t.subtotal}</dt>
        <dd>{formatMoney(q ? q.subtotal : estimate)}</dd>
      </div>
      {q && q.offer_discount > 0 ? (
        <div className="as-sm flex justify-between as-primary">
          <dt>{t.offerDiscount}</dt>
          <dd>−{formatMoney(q.offer_discount)}</dd>
        </div>
      ) : null}
      <div className="as-lg flex justify-between border-t pt-2 font-extrabold">
        <dt>{t.total}</dt>
        <dd>{formatMoney(q ? q.subtotal - q.offer_discount : estimate)}</dd>
      </div>
      {quote.failed ? (
        <p className="as-xs font-semibold text-red-600" role="alert">
          {t.priceFailed}
        </p>
      ) : null}
    </dl>
  );
}
