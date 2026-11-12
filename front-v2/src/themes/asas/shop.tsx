"use client";

import { ImageOff, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { QueryProvider } from "@/lib/query";
import { cartCount, cartPayload, lineKey, useCart } from "@/lib/store/cart";
import { sendStoreEvent, syncCart } from "@/lib/store/events";
import type { StoreConfig } from "@/lib/store/types";
import { TrackingScripts } from "@/lib/tracking/scripts";
import { captureUtm } from "@/lib/tracking/utm";
import { ar } from "@/messages/ar";
import { Footer, Header, WhatsappButton } from "./chrome";
import { StoreLink } from "./context";
import { AsasRoot } from "./root";

const t = ar.storefront;

type Shop = { openCart: () => void; config: StoreConfig };
const ShopContext = React.createContext<Shop | null>(null);

/** The live store around a page (null in the Builder, where nothing is bought). */
export function useShop(): Shop | null {
  return React.useContext(ShopContext);
}

const SYNCED_KEY = "as_cart_synced";

/**
 * Every live store page: the theme frame, header, the page, footer, the cart drawer, the
 * merchant's pixels. Counts the visit and keeps the store's copy of the cart (abandoned carts).
 */
export function AsasShell({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const [drawer, setDrawer] = React.useState(false);
  const cart = useCart();
  const shop = React.useMemo(() => ({ openCart: () => setDrawer(true), config }), [config]);

  React.useEffect(() => {
    captureUtm();
    sendStoreEvent("view");
  }, []);

  // The cart changed: tell the store (debounced; only real changes, not every page view).
  const payload = JSON.stringify(cartPayload(cart));
  React.useEffect(() => {
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(SYNCED_KEY);
    } catch {
      last = null;
    }
    if (last === payload || (last === null && payload === "[]")) return;
    const timer = window.setTimeout(() => {
      syncCart({ items: JSON.parse(payload) });
      try {
        window.localStorage.setItem(SYNCED_KEY, payload);
      } catch {
        // Storage blocked: it syncs again next time.
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [payload]);

  return (
    <QueryProvider>
    <ShopContext.Provider value={shop}>
      <AsasRoot settings={config.design.settings} data={config.data} storeName={config.store_name} mode="live" className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsappButton />
        {drawer ? <CartDrawer onClose={() => setDrawer(false)} /> : null}
      </AsasRoot>
      <TrackingScripts tracking={config.tracking} />
    </ShopContext.Provider>
    </QueryProvider>
  );
}

/** Opens after «أضف للسلة»: what is in the cart, with the way to the cart and the checkout. */
function CartDrawer({ onClose }: { onClose: () => void }) {
  const cart = useCart();
  const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t.cartPage.drawerTitle}>
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label={t.close} />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-(--as-bg) shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="as-base font-bold">
            {t.cartPage.drawerTitle} <span className="as-sm as-muted font-normal">({t.cartPage.items(cartCount(cart))})</span>
          </p>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-lg hover:bg-(--as-soft)" aria-label={t.close}>
            <X className="size-5" />
          </button>
        </div>
        <ul className="flex-1 divide-y overflow-y-auto px-4">
          {cart.items.map((item) => (
            <li key={lineKey(item)} className="flex gap-3 py-3">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--as-soft)">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
                  <img src={item.image} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOff className="size-5 as-muted" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="as-sm line-clamp-2 font-semibold">{item.name}</p>
                {item.options_label ? <p className="as-xs as-muted">{item.options_label}</p> : null}
                <p className="as-sm mt-1">
                  {item.quantity} × {formatMoney(item.price)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t p-4">
          <p className="as-base flex justify-between font-bold">
            <span>{t.cartPage.subtotal}</span>
            <span>{formatMoney(total)}</span>
          </p>
          <StoreLink href="/checkout" className="as-btn as-base w-full">
            {t.cartPage.checkout}
          </StoreLink>
          <StoreLink href="/cart" className="as-sm rounded-lg border py-2.5 text-center font-semibold hover:bg-(--as-soft)">
            {t.cartPage.viewCart}
          </StoreLink>
        </div>
      </div>
    </div>
  );
}
