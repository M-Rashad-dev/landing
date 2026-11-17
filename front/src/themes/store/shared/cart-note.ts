"use client";

import * as React from "react";

const KEY = "as_cart_note";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The customer's note written in the cart (e.g. «ملاحظات للمطبخ»), kept for this visit. */
export function writeCartNote(note: string): void {
  try {
    if (note.trim()) window.sessionStorage.setItem(KEY, note.slice(0, 500));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the note lives on this page only.
  }
  listeners.forEach((l) => l());
}

/** Forgets the note (the order was placed). */
export function clearCartNote(): void {
  writeCartNote("");
}

export function readCartNote(): string {
  return typeof window === "undefined" ? "" : read();
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

/** The cart note and its setter (empty while the server draws the page). */
export function useCartNote(): [string, (note: string) => void] {
  const note = React.useSyncExternalStore(subscribe, read, () => "");
  return [note, writeCartNote];
}

/**
 * What is left to spend for free shipping (null: no free-shipping threshold, or already there).
 * Display only: the checkout's quote is the price.
 */
export function freeShippingLeft(subtotal: number, freeOver: number | null | undefined): { left: number; progress: number } | null {
  if (!freeOver || freeOver <= 0) return null;
  const left = Math.max(0, Math.round((freeOver - subtotal) * 100) / 100);
  return { left, progress: Math.min(1, subtotal / freeOver) };
}
