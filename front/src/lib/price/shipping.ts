import type { Quote } from "@/lib/types";
import type { PublicShipping } from "@/themes/types";

/**
 * Local estimate of the delivery fee on top of a quote, shown while the server quote loads.
 * The server quote (PriceCalculator) is the authority and replaces it.
 */
export function withShipping(quote: Quote | null, shipping: PublicShipping | undefined, governorate: string | null | undefined): Quote | null {
  if (!quote) return null;
  if (!shipping?.enabled) {
    // Shipping off: no delivery line, whatever the server sent (shipping: null).
    if (quote.shipping === undefined) return quote;
    const { shipping: _fee, shipping_free: _free, shipping_available: _available, ...rest } = quote;
    void _fee;
    void _free;
    void _available;
    return rest;
  }
  const items = quote.items_total ?? quote.total;
  if (!governorate) return { ...quote, items_total: items, shipping: null, total: items };
  if (shipping.unavailable.includes(governorate)) return { ...quote, items_total: items, shipping: null, shipping_available: false, total: items };

  const free = shipping.free_over !== null && items >= shipping.free_over;
  const fee = free ? 0 : (shipping.fees[governorate] ?? 0);
  return { ...quote, items_total: items, shipping: fee, shipping_free: free, shipping_available: true, total: Math.round((items + fee) * 100) / 100 };
}
