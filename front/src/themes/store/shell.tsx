"use client";

import * as React from "react";
import { QueryProvider } from "@/lib/query";
import { cartPayload, useCart } from "@/lib/store/cart";
import { sendStoreEvent, syncCart } from "@/lib/store/events";
import type { StoreConfig } from "@/lib/store/types";
import { TrackingScripts } from "@/lib/tracking/scripts";
import { captureUtm } from "@/lib/tracking/utm";
import { storeTheme } from "./registry";
import { ShopProvider } from "./shared/shop";

const SYNCED_KEY = "as_cart_synced";

/**
 * Every live store page, whatever the theme: the theme's frame (header, footer…) around the page,
 * and the merchant's pixels. Counts the visit and keeps the store's copy of the cart (abandoned carts).
 */
export function StoreShell({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const cart = useCart();
  const { Frame } = storeTheme(config.theme_key);

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
      <ShopProvider config={config}>
        <Frame config={config}>{children}</Frame>
        <TrackingScripts tracking={config.tracking} />
      </ShopProvider>
    </QueryProvider>
  );
}
