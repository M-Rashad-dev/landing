"use client";

import { useState } from "react";

const newKey = () => crypto.randomUUID();

/**
 * Client-only keys for a list whose items carry no ids (repeaters), kept in step
 * with the list length (e.g. after an undo). Callers update keys alongside items.
 */
export function useStableKeys(length: number): [string[], (keys: string[]) => void] {
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length }, newKey));

  if (keys.length !== length) {
    const adjusted = keys.length < length ? [...keys, ...Array.from({ length: length - keys.length }, newKey)] : keys.slice(0, length);
    // Adjusting state while rendering (React's documented "previous render" pattern).
    setKeys(adjusted);
    return [adjusted, setKeys];
  }

  return [keys, setKeys];
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(index, 0, item);
  return next;
}

export { newKey };
