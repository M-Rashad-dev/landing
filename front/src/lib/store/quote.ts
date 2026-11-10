"use client";

import { useEffect, useState } from "react";
import { cartPayload, type Cart } from "./cart";

/** Server quote of a cart (back: App\Pricing\CartQuote::toArray). */
export type CartQuote = {
  lines: Array<{
    product_id: number;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    offer: { id: number; name: string } | null;
    offer_discount: number;
    total: number;
    options: Array<{ option: string; value: string; price_delta: number }>;
    gift: { product_id: number; name: string } | null;
  }>;
  items_count: number;
  subtotal: number;
  offer_discount: number;
  code: string | null;
  code_discount: number;
  code_error: string | null;
  shipping: number | null;
  shipping_free: boolean;
  shipping_available: boolean;
  total: number;
};

export type QuoteState = { quote: CartQuote | null; loading: boolean; lineErrors: Record<number, string>; failed: boolean };

/**
 * Live price of the cart from the server (debounced). Line problems (a product that left the
 * store, not enough stock, a missing option) come back per line index.
 */
export function useCartQuote(cart: Cart, extra: { code?: string | null; governorate?: string | null; phone?: string | null } = {}): QuoteState {
  const items = JSON.stringify(cartPayload(cart));
  const { code = null, governorate = null, phone = null } = extra;
  const requestKey = JSON.stringify([items, code, governorate, phone]);
  // The last answer and the request it answers: anything else is still loading.
  const [result, setResult] = useState<{ key: string; quote: CartQuote | null; lineErrors: Record<number, string>; failed: boolean } | null>(null);

  useEffect(() => {
    const parsed = JSON.parse(items) as unknown[];
    if (parsed.length === 0) return;
    const controller = new AbortController();
    const setState = (value: Omit<QuoteState, "loading">) => setResult({ key: requestKey, ...value });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/public/store/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: parsed, code, governorate, phone }),
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => ({}))) as { data?: CartQuote; errors?: Record<string, string[]> };
        if (response.ok && json.data) {
          setState({ quote: json.data, lineErrors: {}, failed: false });
          return;
        }
        const lineErrors: Record<number, string> = {};
        for (const [key, messages] of Object.entries(json.errors ?? {})) {
          const match = key.match(/^items\.(\d+)\./);
          if (match) lineErrors[Number(match[1])] ??= messages[0] ?? "";
        }
        setState({ quote: null, lineErrors, failed: Object.keys(lineErrors).length === 0 });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState({ quote: null, lineErrors: {}, failed: true });
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [items, code, governorate, phone, requestKey]);

  if (cart.items.length === 0) return { quote: null, loading: false, lineErrors: {}, failed: false };
  if (!result) return { quote: null, loading: true, lineErrors: {}, failed: false };
  // Keep showing the previous numbers while the new quote is on its way.
  return { quote: result.quote, lineErrors: result.lineErrors, failed: result.failed, loading: result.key !== requestKey };
}
