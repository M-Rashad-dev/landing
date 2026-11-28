"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * A list of product ids kept in the visitor's browser (localStorage, one per store host), synced between tabs and
 * components like the cart. Used by «قارن» and «المفضلة»; nothing is stored on the server.
 */
export type IdList = {
  max: number;
  read: () => number[];
  use: () => number[];
  /** "added", "there" (already in it) or "full". */
  add: (id: number) => "added" | "there" | "full";
  remove: (id: number) => void;
  /** Adds or removes; "full" when it could not be added. */
  toggle: (id: number) => "added" | "removed" | "full";
  clear: () => void;
};

const EMPTY: number[] = [];

export function parseIds(raw: string | null, max: number): number[] {
  if (!raw) return EMPTY;
  try {
    const json = JSON.parse(raw) as unknown;
    if (!Array.isArray(json)) return EMPTY;
    const ids = json.filter((v): v is number => Number.isInteger(v) && v > 0);
    return [...new Set(ids)].slice(0, max);
  } catch {
    return EMPTY;
  }
}

export function idList(key: string, max: number): IdList {
  const event = `${key}:change`;
  let cached: { raw: string | null; ids: number[] } = { raw: null, ids: EMPTY };

  const read = (): number[] => {
    if (typeof window === "undefined") return EMPTY;
    let raw: string | null = cached.raw;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // Storage blocked: what this page view saved stays.
    }
    if (raw !== cached.raw) cached = { raw, ids: parseIds(raw, max) };
    return cached.ids;
  };

  const write = (ids: number[]) => {
    const raw = JSON.stringify(ids);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      // Storage blocked: kept for this page view only.
    }
    cached = { raw, ids };
    window.dispatchEvent(new Event(event));
  };

  const subscribe = (callback: () => void) => {
    window.addEventListener(event, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(event, callback);
      window.removeEventListener("storage", callback);
    };
  };

  const add = (id: number) => {
    const ids = read();
    if (ids.includes(id)) return "there" as const;
    if (ids.length >= max) return "full" as const;
    write([...ids, id]);
    return "added" as const;
  };
  const remove = (id: number) => write(read().filter((x) => x !== id));

  return {
    max,
    read,
    use: () => useSyncExternalStore(subscribe, read, () => EMPTY),
    add,
    remove,
    toggle: (id) => {
      if (read().includes(id)) {
        remove(id);
        return "removed";
      }
      return add(id) === "full" ? "full" : "added";
    },
    clear: () => write([]),
  };
}

/**
 * GETs a store endpoint for these ids (none → nothing is asked). `data` is null while loading; `failed` on a
 * network or server error.
 */
export function useIdsFetch<T>(path: string, ids: number[]): { data: T | null; loading: boolean; failed: boolean; retry: () => void } {
  const key = ids.join(",");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data: T | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`${path}?ids=${key}`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as { data?: T };
        setResult({ key, data: response.ok && json.data ? json.data : null, failed: !response.ok || !json.data });
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setResult({ key, data: null, failed: true });
      });
    return () => controller.abort();
  }, [path, key, attempt]);

  const current = result && result.key === key ? result : null;
  return {
    data: key ? (current?.data ?? null) : null,
    loading: Boolean(key) && current === null,
    failed: current?.failed ?? false,
    retry: () => {
      setResult(null);
      setAttempt((n) => n + 1);
    },
  };
}
