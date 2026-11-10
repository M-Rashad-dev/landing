"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's cart, kept in localStorage per store host. It only holds what the visitor
 * picked (product, options, quantity) plus display copies (name, image, price) for the cart
 * drawer; every price shown at checkout comes from the server quote.
 */

export const MAX_CART_LINES = 30;
export const MAX_LINE_QUANTITY = 50;
const STORAGE_KEY = "lp_cart_v1";
const EVENT = "lp-cart";

export type CartItem = {
  product_id: number;
  quantity: number;
  /** option id → value id */
  options: Record<string, number>;
  /** Display copies. */
  name: string;
  slug: string | null;
  image: string | null;
  price: number;
  /** "المقاس: XL، اللون: أحمر" */
  options_label: string;
};

export type Cart = { items: CartItem[] };

const EMPTY: Cart = { items: [] };
let cached: { raw: string | null; cart: Cart } = { raw: null, cart: EMPTY };

/** Same product + same options = same line. */
export function lineKey(item: Pick<CartItem, "product_id" | "options">): string {
  const opts = Object.entries(item.options)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  return `${item.product_id}|${opts}`;
}

function isItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.product_id) && Number.isInteger(v.quantity) && typeof v.options === "object" && v.options !== null && typeof v.name === "string";
}

export function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY;
  try {
    const json = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(json.items)) return EMPTY;
    const items = json.items
      .filter(isItem)
      .slice(0, MAX_CART_LINES)
      .map((item) => ({ ...item, quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, item.quantity)) }));
    return { items };
  } catch {
    return EMPTY;
  }
}

function read(): Cart {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cached.raw) cached = { raw, cart: parseCart(raw) };
  return cached.cart;
}

function write(cart: Cart): void {
  const raw = JSON.stringify(cart);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage blocked: keep it for this page view only.
  }
  cached = { raw, cart };
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Adds (or merges into the same line). Returns false when the cart is full. */
export function addToCart(item: CartItem): boolean {
  const cart = read();
  const key = lineKey(item);
  const existing = cart.items.find((i) => lineKey(i) === key);
  if (existing) {
    write({ items: cart.items.map((i) => (lineKey(i) === key ? { ...i, ...item, quantity: Math.min(MAX_LINE_QUANTITY, i.quantity + item.quantity) } : i)) });
    return true;
  }
  if (cart.items.length >= MAX_CART_LINES) return false;
  write({ items: [...cart.items, { ...item, quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, item.quantity)) }] });
  return true;
}

export function setQuantity(key: string, quantity: number): void {
  const cart = read();
  write({ items: cart.items.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, quantity)) } : i)) });
}

export function removeFromCart(key: string): void {
  write({ items: read().items.filter((i) => lineKey(i) !== key) });
}

export function clearCart(): void {
  write(EMPTY);
}

/** What the server needs for a quote / order. */
export function cartPayload(cart: Cart): Array<{ product_id: number; quantity: number; options: Record<string, number> }> {
  return cart.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, options: item.options }));
}
