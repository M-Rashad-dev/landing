"use client";

import { useEffect, useState } from "react";
import { cartPayload, type Cart } from "./cart";
import type { CartQuote } from "./types";

export type QuoteExtra = { code?: string | null; governorate?: string | null; phone?: string | null; shipping_company_id?: number | null };
export type QuoteState = { quote: CartQuote | null; loading: boolean; lineErrors: Record<number, string>; codeError: string | null; failed: boolean };

/**
 * Live price of the cart from the server (debounced). Line problems (a product that left the
 * store, not enough stock, a missing option) come back per line index.
 */
export function useCartQuote(cart: Cart, extra: QuoteExtra = {}): QuoteState {
  const items = JSON.stringify(cartPayload(cart));
  const { code = null, governorate = null, phone = null, shipping_company_id = null } = extra;
  const requestKey = JSON.stringify([items, code, governorate, phone, shipping_company_id]);
  // The last answer and the request it answers: anything else is still loading.
  const [result, setResult] = useState<({ key: string } & Omit<QuoteState, "loading">) | null>(null);

  useEffect(() => {
    const parsed = JSON.parse(items) as unknown[];
    if (parsed.length === 0) return;
    const controller = new AbortController();
    const done = (value: Omit<QuoteState, "loading">) => setResult({ key: requestKey, ...value });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/public/store/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: parsed, code, governorate, phone, shipping_company_id }),
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => ({}))) as { data?: CartQuote; errors?: Record<string, string[]> };
        if (response.ok && json.data) {
          done({ quote: json.data, lineErrors: {}, codeError: json.data.code_error, failed: false });
          return;
        }
        const lineErrors: Record<number, string> = {};
        for (const [key, messages] of Object.entries(json.errors ?? {})) {
          const match = key.match(/^items\.(\d+)/);
          if (match) lineErrors[Number(match[1])] ??= messages[0] ?? "";
        }
        done({ quote: null, lineErrors, codeError: json.errors?.code?.[0] ?? null, failed: Object.keys(lineErrors).length === 0 });
      } catch (error) {
        if ((error as Error).name !== "AbortError") done({ quote: null, lineErrors: {}, codeError: null, failed: true });
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [items, code, governorate, phone, shipping_company_id, requestKey]);

  if (cart.items.length === 0) return { quote: null, loading: false, lineErrors: {}, codeError: null, failed: false };
  if (!result) return { quote: null, loading: true, lineErrors: {}, codeError: null, failed: false };
  // Keep the previous numbers on screen while the new quote is on its way.
  return { quote: result.quote, lineErrors: result.lineErrors, codeError: result.codeError, failed: result.failed, loading: result.key !== requestKey };
}
