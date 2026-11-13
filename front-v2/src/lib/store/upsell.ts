/** The post-order offer from the order answer, kept in this tab for the thank-you screen. */
export type UpsellOfferData = {
  id: number;
  token: string;
  headline: string;
  description: string | null;
  product: { name: string; image: { urls: Record<string, string>; alt?: string | null } | null };
  price: number;
  regular_price: number;
};

const KEY = "lp_upsell";

export function saveUpsell(orderNumber: number, offer: UpsellOfferData | null | undefined): void {
  try {
    if (offer) window.sessionStorage.setItem(KEY, JSON.stringify({ order_number: orderNumber, offer }));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: no offer on the thank-you screen.
  }
}

/** The offer saved for this order, or null (another order, or none). */
export function readUpsell(orderNumber: number): UpsellOfferData | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as { order_number?: number; offer?: UpsellOfferData }) : null;
    return saved?.order_number === orderNumber && saved.offer ? saved.offer : null;
  } catch {
    return null;
  }
}

export function clearUpsell(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
