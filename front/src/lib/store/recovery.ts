"use client";

import { replaceCart, type CartItem } from "./cart";

/** back end: App\Recovery\CartRecovery::restore */
export type Recovered = {
  kind: "store" | "landing";
  items: Array<{ product_id: number; quantity: number; options: Record<string, number>; name: string; slug: string; image: string | null; price: number; options_label: string; digital: boolean }>;
  customer: { name: string | null; phone: string | null; email: string | null };
  quantity: number;
};

/** The «r» token a cart reminder's link carries (24 hex), or null. */
export function recoveryToken(search: string): string | null {
  const token = new URLSearchParams(search).get("r");
  return token && /^[a-f0-9]{24}$/.test(token) ? token : null;
}

/** Fetches what the link refills; null when the link is unknown / old / from another store. */
export async function fetchRecovered(token: string): Promise<Recovered | null> {
  try {
    const response = await fetch(`/api/public/recovery?token=${token}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: Recovered };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Puts the left cart back (store links) and drops «r» from the address bar. */
export function applyRecovered(data: Recovered): void {
  if (data.kind === "store") {
    replaceCart(
      data.items.map(
        (i): CartItem => ({ product_id: i.product_id, quantity: i.quantity, options: i.options, name: i.name, slug: i.slug, image: i.image, price: i.price, options_label: i.options_label, ...(i.digital ? { digital: true } : {}), max: null }),
      ),
    );
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("r");
  window.history.replaceState(window.history.state, "", url.toString());
}
