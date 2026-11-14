"use client";

import * as React from "react";
import { QueryProvider } from "@/lib/query";
import { cartPayload, useCart } from "@/lib/store/cart";
import { sendStoreEvent, syncCart } from "@/lib/store/events";
import type { StoreConfig } from "@/lib/store/types";
import { TrackingScripts } from "@/lib/tracking/scripts";
import { captureUtm } from "@/lib/tracking/utm";
import { Footer, Header, WhatsappButton } from "./chrome";
import { AsasRoot } from "./root";

type Shop = { config: StoreConfig };
const ShopContext = React.createContext<Shop | null>(null);

/** The live store around a page (null in the Builder, where nothing is bought). */
export function useShop(): Shop | null {
  return React.useContext(ShopContext);
}

const SYNCED_KEY = "as_cart_synced";

/**
 * Every live store page: the theme frame, header, the page, footer, the
 * merchant's pixels. Counts the visit and keeps the store's copy of the cart (abandoned carts).
 */
export function AsasShell({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const cart = useCart();
  const shop = React.useMemo(() => ({ config }), [config]);

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
      </AsasRoot>
      <TrackingScripts tracking={config.tracking} />
    </ShopContext.Provider>
    </QueryProvider>
  );
}
