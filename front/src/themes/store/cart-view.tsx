"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/price";
import { lineKey, removeFromCart, setQuantity, useCart, MAX_LINE_QUANTITY } from "@/lib/store/cart";
import { useCartQuote } from "@/lib/store/quote";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { QuantityStepper } from "@/themes/shared/components/quantity-stepper";
import { storePaths } from "@/themes/shared/store/links";

const t = siteMessages.store;
const noop = () => () => undefined;

/** True once the browser cart is readable (avoids flashing "empty" before hydration). */
function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function CartView({ surface, button, muted }: { surface: string; button: string; muted: string }) {
  const hydrated = useHydrated();
  const cart = useCart();
  const { quote, loading, lineErrors } = useCartQuote(cart);

  if (!hydrated) return <div className={cn(surface, "h-64 animate-pulse")} aria-busy />;

  if (cart.items.length === 0) {
    return (
      <div className={cn(surface, "flex flex-col items-center gap-3 py-16 text-center")} data-testid="cart-empty">
        <ShoppingBag className="size-10 opacity-40" aria-hidden />
        <p className="t-heading text-lg font-bold">{t.emptyCart}</p>
        <p className={muted}>{t.emptyCartText}</p>
        <a href={storePaths.products} className={cn(button, "mt-2")}>
          {t.continueShopping}
        </a>
      </div>
    );
  }

  const blocked = Object.keys(lineErrors).length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ul className={cn(surface, "divide-y divide-[var(--c-border)] p-0 md:p-0")} data-testid="cart-lines">
        {cart.items.map((item, index) => {
          const key = lineKey(item);
          const line = quote?.lines[index];
          return (
            <li key={key} className="flex gap-3 p-4">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- media thumbnail
                <img src={item.image} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="t-tint size-20 shrink-0 rounded-xl" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <a href={item.slug ? storePaths.product(item.slug) : undefined} className="t-heading line-clamp-2 font-bold">
                  {item.name}
                </a>
                {item.options_label ? <p className={cn(muted, "text-xs")}>{item.options_label}</p> : null}
                {line?.offer ? <p className="text-xs font-semibold text-[var(--c-accent)]">{`${t.offer}: ${line.offer.name}`}</p> : null}
                {line?.gift ? <p className="text-xs font-semibold text-[var(--c-accent)]">{t.gift(line.gift.name)}</p> : null}
                {lineErrors[index] ? (
                  <p className="text-xs font-semibold text-red-600" role="alert">
                    {lineErrors[index]}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <QuantityStepper value={item.quantity} onChange={(q) => setQuantity(key, q)} min={1} max={MAX_LINE_QUANTITY} />
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{formatPrice(line ? line.total : item.price * item.quantity)}</span>
                    <button type="button" onClick={() => removeFromCart(key)} className={cn(muted, "rounded-full p-2 hover:text-red-600")} aria-label={`${t.remove} ${item.name}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className={cn(surface, "flex h-fit flex-col gap-3")} aria-live="polite">
        <p className="t-heading font-bold">{siteMessages.summary}</p>
        <Row label={siteMessages.subtotal} value={quote ? formatPrice(quote.subtotal) : "—"} />
        {quote && quote.offer_discount > 0 ? <Row label={siteMessages.offerDiscount} value={`− ${formatPrice(quote.offer_discount)}`} /> : null}
        <Row label={siteMessages.total} value={quote ? formatPrice(quote.total - (quote.shipping ?? 0)) : "—"} strong />
        <p className={cn(muted, "text-xs")}>{loading ? t.updating : siteMessages.cod}</p>
        {blocked ? (
          <p className="text-sm font-semibold text-red-600">{t.lineUnavailable}</p>
        ) : (
          <a href={storePaths.checkout} className={cn(button, "w-full")} data-testid="go-checkout">
            {t.checkout}
          </a>
        )}
        <a href={storePaths.products} className={cn(muted, "text-center text-sm hover:underline")}>
          {t.continueShopping}
        </a>
      </aside>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={cn("flex items-center justify-between text-sm", strong && "text-base font-extrabold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
