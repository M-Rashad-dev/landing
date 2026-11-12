"use client";

import { captureUtm } from "@/lib/tracking/utm";
import { cartPayload, type Cart } from "./cart";

export type StoreEventType = "view" | "product_view" | "add_to_cart" | "checkout";

function device(): "mobile" | "desktop" {
  try {
    return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches ? "desktop" : "mobile";
  } catch {
    return "mobile";
  }
}

function send(path: string, body: unknown): void {
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Store traffic counters (first-party, no personal data). Views and checkouts count once per
 * browser session (per product for product views); adding to the cart counts every time.
 * Fire-and-forget: analytics never blocks or breaks the store.
 */
export function sendStoreEvent(type: StoreEventType, onceKey = ""): void {
  if (type !== "add_to_cart") {
    const flag = `as_ev_${type}_${onceKey}`;
    try {
      if (window.sessionStorage.getItem(flag) === "1") return;
      window.sessionStorage.setItem(flag, "1");
    } catch {
      // Storage blocked: count anyway.
    }
  }
  const utm = captureUtm();
  send("/api/public/store/events", { type, utm_source: utm.source ?? null, referrer: utm.referrer ?? null, device: device() });
}

const TOKEN_KEY = "as_cart_token";

/** A random id for this browser's cart: the store follows an abandoned cart up by it. */
export function cartToken(): string {
  try {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return "";
  }
}

/** A new token after an order: the next cart is a new one. */
export function resetCartToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to reset.
  }
}

/** The cart as the store sees it (abandoned carts); an empty cart removes it. */
export function syncCart(cart: Cart, contact: { phone?: string | null; name?: string | null } = {}): void {
  const token = cartToken();
  if (!token) return;
  send("/api/public/store/carts", { cart_token: token, items: cartPayload(cart), phone: contact.phone ?? null, name: contact.name ?? null });
}
