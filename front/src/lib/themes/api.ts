"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";

export type ThemeKind = "landing" | "store";
export type ThemeTag = { id: number; slug: string; name: string };
export type ThemeImage = { id: number; kind: "cover" | "desktop" | "mobile"; urls: { medium: string; large: string }; width: number; height: number };
export type ThemePrice = { original: number; discount_percent: number; final: number; discount_ends_at: string | null };

/** One theme as the theme store shows it (back: ThemePresenter). */
export type ThemeRow = {
  key: string;
  name: string;
  kind: ThemeKind;
  short_description: string | null;
  price: ThemePrice | null;
  is_free: boolean;
  is_featured: boolean;
  is_new: boolean;
  released_at: string | null;
  cover: { medium: string; large: string } | null;
  tags: ThemeTag[];
  sales: number;
  min_plan: { key: string; name: string } | null;
  /** For the signed-in store. */
  owned?: boolean;
  can_publish?: boolean;
  /** Detail only. */
  description?: string | null;
  features?: string[];
  images?: ThemeImage[];
  version?: string | null;
};

export type StoreFilters = { kind?: string; tag?: string; price?: string; q?: string; sort?: string };

export const themeKeys = {
  mine: ["themes", "mine"] as const,
  store: (filters: StoreFilters) => ["themes", "store", filters] as const,
  one: (key: string) => ["themes", "one", key] as const,
};

/** Every active theme with owned / can_publish (wizard, builder, «ثيماتي»). */
export function useMyThemes() {
  return useQuery({ queryKey: themeKeys.mine, queryFn: ({ signal }) => api<ThemeRow[]>("/dashboard/themes", { signal }) });
}

export function useThemeStore(filters: StoreFilters) {
  return useQuery({
    queryKey: themeKeys.store(filters),
    queryFn: async () => {
      const res = await apiPage<ThemeRow>("/dashboard/theme-store", { query: filters });
      return { themes: res.data, tags: (res.meta as unknown as { tags: ThemeTag[] }).tags };
    },
    placeholderData: keepPreviousData,
  });
}

export function useThemeDetail(key: string) {
  return useQuery({ queryKey: themeKeys.one(key), queryFn: () => api<ThemeRow>(`/dashboard/theme-store/${encodeURIComponent(key)}`) });
}

