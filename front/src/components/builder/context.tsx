"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { BuilderActions, BuilderState, BuilderStore } from "./store";

const BuilderContext = createContext<BuilderStore | null>(null);

export function BuilderProvider({ store, children }: { store: BuilderStore; children: ReactNode }) {
  return <BuilderContext.Provider value={store}>{children}</BuilderContext.Provider>;
}

export function useBuilderStore(): BuilderStore {
  const store = useContext(BuilderContext);
  if (!store) throw new Error("useBuilderStore must be used inside BuilderProvider");
  return store;
}

export function useBuilder<T>(selector: (state: BuilderState & BuilderActions) => T): T {
  return useStore(useBuilderStore(), selector);
}
