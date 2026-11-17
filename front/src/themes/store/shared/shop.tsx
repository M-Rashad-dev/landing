"use client";

import * as React from "react";
import type { StoreConfig } from "@/lib/store/types";

type Shop = { config: StoreConfig };
const ShopContext = React.createContext<Shop | null>(null);

/** The live store's config around every page (StoreShell). */
export function ShopProvider({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const shop = React.useMemo(() => ({ config }), [config]);
  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

/** The live store around a page (null in the Builder, where nothing is bought). */
export function useShop(): Shop | null {
  return React.useContext(ShopContext);
}
