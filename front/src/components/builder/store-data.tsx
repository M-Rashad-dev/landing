"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Store categories for the store-home section settings (category pickers, store links). */
export type BuilderCategory = { id: number; name: string; slug: string; depth: number };

const StoreDataContext = createContext<BuilderCategory[]>([]);

export function BuilderStoreData({ categories, children }: { categories: BuilderCategory[]; children: ReactNode }) {
  return <StoreDataContext.Provider value={categories}>{children}</StoreDataContext.Provider>;
}

export function useBuilderCategories(): BuilderCategory[] {
  return useContext(StoreDataContext);
}
