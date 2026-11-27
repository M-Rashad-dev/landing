"use client";

import { Banknote, Gift, ImageOff, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { lineKey, lineLimit, removeFromCart, setQuantity, useCart, type Cart } from "@/lib/store/cart";
import { useCartQuote, type QuoteState } from "@/lib/store/quote";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { freeShippingLeft, useCartNote } from "@/themes/store/shared/cart-note";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import { useShop } from "@/themes/store/shared/shop";
import { RawaqCard } from "../card";
import { useRawaqCart, useRawaq } from "../root";

const t = ar.storefront.cartPage;
const ts = ar.rawaqStore.cartPage;

/** The cart's lines as «رواق» draws them (also under the checkout, without editing). */
export function RawaqCartLines({ cart, quote, editable = true }: { cart: Cart; quote: QuoteState; editable?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {cart.items.map((item, i) => {
        const key = lineKey(item);
        const line = quote.quote?.lines[i];
        return (
          <li key={key} className="rq-card flex gap-3 p-3">
            <StoreLink href={`/products/${encodeURIComponent(item.slug)}`} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-(--rq-blush) @3xl:size-24">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
                <img src={item.image} alt="" className="size-full object-cover" />
              ) : (
                <ImageOff className="size-6 as-muted" aria-hidden />
              )}
            </StoreLink>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <StoreLink href={`/products/${encodeURIComponent(item.slug)}`} className="rq-display as-lg line-clamp-2 hover:text-(--as-primary)">
                  {item.name}
                </StoreLink>
                {editable ? (
                  <button type="button" onClick={() => removeFromCart(key)} className="flex size-9 shrink-0 items-center justify-center rounded-full as-muted hover:bg-red-50 hover:text-red-600" aria-label={`${t.remove} ${item.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
              {item.options_label ? <p className="as-xs as-muted">{item.options_label}</p> : null}
              {line?.offer ? <p className="as-xs font-bold text-(--as-primary)">{line.offer.name}</p> : null}
              {line?.gift ? (
                <p className="as-xs flex items-center gap-1 font-bold text-(--as-primary)">
                  <Gift className="size-3.5" aria-hidden />
                  {t.gift(line.gift.name)}
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                {editable ? (
                  <div className="flex h-9 items-center rounded-full border-2" role="group" aria-label={ar.rawaqStore.product.quantity}>
                    <button type="button" onClick={() => setQuantity(key, Math.max(1, item.quantity - 1))} disabled={item.quantity <= 1} className="flex size-8 items-center justify-center disabled:opacity-40" aria-label={ar.rawaqStore.product.less}>
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="as-sm w-7 text-center font-extrabold tabular-nums">{item.quantity}</span>
                    <button type="button" onClick={() => setQuantity(key, Math.min(lineLimit(item), item.quantity + 1))} disabled={item.quantity >= lineLimit(item)} className="flex size-8 items-center justify-center disabled:opacity-40" aria-label={ar.rawaqStore.product.more}>
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <span className="as-sm as-muted">× {item.quantity}</span>
                )}
                <span className="flex items-baseline gap-2">
                  {line && line.offer_discount > 0 ? <s className="as-xs as-muted">{formatMoney(line.subtotal)}</s> : null}
                  <b className="as-lg font-extrabold">{formatMoney(line ? line.total : item.price * item.quantity)}</b>
                </span>
              </div>
              {quote.lineErrors[i] ? (
                <p className="as-xs font-bold text-red-600" role="alert">
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

/** «فاضل كذا على التوصيل ببلاش»: from the store's free-shipping threshold. */
function FreeShipping({ subtotal }: { subtotal: number }) {
  const shop = useShop();
  const free = freeShippingLeft(subtotal, shop?.config.shipping.enabled ? shop.config.shipping.free_over : null);
  if (!free) return null;
  return (
    <div className={cn("flex flex-col gap-2 rounded-3xl p-4", free.left === 0 ? "bg-emerald-50 text-emerald-800" : "bg-(--rq-blush)")}>
      <p className="as-sm flex items-center gap-2 font-extrabold">
        <Truck className="size-4" aria-hidden />
        {free.left === 0 ? ts.freeDone : ts.freeLeft(free.left)}
      </p>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(free.progress * 100)}>
        <div className="h-full rounded-full bg-(--as-primary) transition-[width] duration-500" style={{ width: `${free.progress * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * «رواق»'s cart, as the merchant set it in «السلة»: the lines, the free-shipping bar, the order note
 * (carried to the checkout), the totals and the suggestions.
 */
export function RawaqCartView() {
  const cart = useCart();
  const hydrated = useHydrated();
  const quote = useCartQuote(cart);
  const look = useRawaqCart();
  const { data } = useRawaq();
  const [note, setNote] = useCartNote();
  const q = quote.quote;
  const estimate = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = q ? q.subtotal - q.offer_discount : estimate;
  const inCart = new Set(cart.items.map((i) => i.product_id));
  const suggestions = look.suggestions_enabled ? (data.cart_products ?? []).filter((p) => !inCart.has(p.id)).slice(0, 4) : [];

  if (!hydrated) return <div className="rq-wrap min-h-[50vh] py-8" />;

  return (
    <div className="rq-wrap flex flex-col gap-8 py-8 @3xl:py-12">
      <h1 className="rq-display rq-title">{t.title}</h1>
      {cart.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-(--rq-blush) text-(--as-primary)">
            <ShoppingBag className="size-8" aria-hidden />
          </span>
          <p className="rq-display as-xl">{t.empty}</p>
          <p className="as-sm as-muted">{t.emptyHint}</p>
          <StoreLink href="/products" className="rq-btn rq-btn-main as-base h-12 px-8">
            {t.shop}
          </StoreLink>
        </div>
      ) : (
        <div className="grid items-start gap-6 @4xl:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-4">
            {look.free_shipping_bar ? <FreeShipping subtotal={subtotal} /> : null}
            <RawaqCartLines cart={cart} quote={quote} />
            {look.order_notes ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rq-cart-note" className="as-sm font-extrabold">
                  {ts.notes}
                </label>
                <textarea id="rq-cart-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="rq-cart-note-hint" className="as-base rounded-2xl border-2 bg-(--as-bg) p-3 outline-none focus:border-(--as-primary)" />
                <span id="rq-cart-note-hint" className="as-xs as-muted">
                  {ts.notesHint}
                </span>
              </div>
            ) : null}
          </div>
          <aside className="rq-card flex flex-col gap-3 p-5 @4xl:sticky @4xl:top-28">
            <dl className={cn("flex flex-col gap-2", quote.loading && "opacity-60 transition-opacity")} aria-busy={quote.loading}>
              <div className="as-sm flex justify-between">
                <dt className="as-muted">{t.subtotal}</dt>
                <dd>{formatMoney(q ? q.subtotal : estimate)}</dd>
              </div>
              {q && q.offer_discount > 0 ? (
                <div className="as-sm flex justify-between text-(--as-primary)">
                  <dt>{t.offerDiscount}</dt>
                  <dd>−{formatMoney(q.offer_discount)}</dd>
                </div>
              ) : null}
              <div className="as-xl flex justify-between border-t pt-2 font-extrabold">
                <dt>{t.total}</dt>
                <dd>{formatMoney(subtotal)}</dd>
              </div>
              {quote.failed ? (
                <p className="as-xs font-bold text-red-600" role="alert">
                  {t.priceFailed}
                </p>
              ) : null}
            </dl>
            <p className="as-xs as-muted">{t.shippingNote}</p>
            <StoreLink href="/checkout" className="rq-btn rq-btn-main as-base h-12 w-full" aria-disabled={Object.keys(quote.lineErrors).length > 0 || undefined}>
              {t.checkout}
            </StoreLink>
            <p className="as-xs flex items-center justify-center gap-1.5 as-muted">
              <Banknote className="size-4" aria-hidden />
              {ts.secure}
            </p>
            <StoreLink href="/products" className="as-sm text-center font-extrabold text-(--as-primary) hover:underline">
              {t.continue}
            </StoreLink>
          </aside>
        </div>
      )}

      {suggestions.length ? (
        <section className="flex flex-col gap-5 border-t pt-8">
          <h2 className="rq-display rq-title">{ts.suggestions}</h2>
          <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-5">
            {suggestions.map((p) => (
              <li key={p.id}>
                <RawaqCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
