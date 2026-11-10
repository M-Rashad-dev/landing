"use client";

import { captureUtm } from "@/lib/tracking/utm";

export type StoreEventType = "view" | "product_view" | "add_to_cart" | "checkout";

function device(): "mobile" | "desktop" {
  try {
    return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches ? "desktop" : "mobile";
  } catch {
    return "mobile";
  }
}

/**
 * Store traffic counters (first-party, no personal data). Views and checkouts count once per
 * browser session (per product for product views); adding to the cart counts every time.
 * Fire-and-forget: analytics never blocks or breaks the store.
 */
export function sendStoreEvent(type: StoreEventType, onceKey?: string): void {
  if (type !== "add_to_cart") {
    const flag = `lp_sev_${type}_${onceKey ?? ""}`;
    try {
      if (window.sessionStorage.getItem(flag) === "1") return;
      window.sessionStorage.setItem(flag, "1");
    } catch {
      // Storage blocked: count anyway.
    }
  }
  const utm = captureUtm();
  fetch("/api/public/store/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ type, utm_source: utm.source ?? null, referrer: utm.referrer ?? null, device: device() }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
