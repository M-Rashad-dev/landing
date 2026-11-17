import type * as React from "react";
import type { StoreConfig } from "@/lib/store/types";
import { AsasFrame, AsasStore, HomeSections, type Selection } from "./asas/asas-store";
import { AccountView, MyOrderView, SignInView } from "./asas/pages/account";
import { CartView } from "./asas/pages/cart";
import { CheckoutView } from "./asas/pages/checkout";
import { OrderDone, StaticPageView, StoreNotFound } from "./asas/pages/info";
import { Listing } from "./asas/pages/listing";
import { ProductView } from "./asas/pages/product";
import { TrackView } from "./asas/pages/track";
import { ASAS_KEY, type Design } from "./asas/types";
import type { ThemeMode } from "./shared/context";
import type { DesignData } from "./shared/types";
import { ShabeFrame, ShabeHomeSections, ShabeStore } from "./shabe/shabe-store";
import { SHABE_STORE_KEY, type ShabeStoreDesign, type ShabeStoreSection } from "./shabe/types";
import { SufiFrame, SufiHomeSections, SufiStore } from "./sufi/sufi-store";
import { SUFI_KEY, type Scheme, type SufiDesign, type SufiSection } from "./sufi/types";

/** The whole home in one piece: the Builder (sections selectable), its preview and the theme showcase. */
export type CanvasProps = {
  design: unknown;
  data: DesignData;
  storeName: string;
  mode?: ThemeMode;
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  media?: DesignData["media"];
  tools?: (id: Selection) => React.ReactNode;
  /** Themes with a dark mode: the scheme the Builder previews. */
  scheme?: Scheme;
};

/** «أساس»'s inner pages; a theme with its own pages builds them on the hooks in ./shared. */
const ASAS_PAGES = {
  Product: ProductView,
  Listing,
  Cart: CartView,
  Checkout: CheckoutView,
  OrderDone,
  StaticPage: StaticPageView,
  NotFound: StoreNotFound,
  Track: TrackView,
  SignIn: SignInView,
  Account: AccountView,
  MyOrder: MyOrderView,
};

export type StoreTheme = {
  /** Header, the page and footer around every live page. */
  Frame: React.ComponentType<{ config: StoreConfig; children: React.ReactNode }>;
  /** The home sections of the live store (inside the frame). */
  Home: React.ComponentType<{ config: StoreConfig }>;
  Canvas: React.ComponentType<CanvasProps>;
  pages: typeof ASAS_PAGES;
};

function AsasHome({ config }: { config: StoreConfig }) {
  return <HomeSections sections={config.design.sections} />;
}

function AsasCanvas({ design, scheme: _scheme, ...rest }: CanvasProps) {
  void _scheme;
  return <AsasStore design={design as Design} {...rest} />;
}

function SufiHome({ config }: { config: StoreConfig }) {
  return <SufiHomeSections sections={config.design.sections as unknown as SufiSection[]} />;
}

function SufiCanvas({ design, ...rest }: CanvasProps) {
  return <SufiStore design={design as SufiDesign} {...rest} />;
}

function ShabeHome({ config }: { config: StoreConfig }) {
  return <ShabeHomeSections sections={config.design.sections as unknown as ShabeStoreSection[]} />;
}

function ShabeCanvas({ design, scheme: _scheme, ...rest }: CanvasProps) {
  void _scheme;
  return <ShabeStore design={design as ShabeStoreDesign} {...rest} />;
}

/**
 * Every store theme by key: what the live store, the Builder and the preview draw. A new store
 * theme is added here once (its frame, home, canvas and pages); nothing else picks by key.
 */
const STORE_THEMES: Record<string, StoreTheme> = {
  [ASAS_KEY]: { Frame: AsasFrame, Home: AsasHome, Canvas: AsasCanvas, pages: ASAS_PAGES },
  // «صوفي» draws its own frame and home; its inner pages are «أساس»'s in its colors (for now).
  [SUFI_KEY]: { Frame: SufiFrame, Home: SufiHome, Canvas: SufiCanvas, pages: ASAS_PAGES },
  // «شابع · متجر»: its own frame and home; its own inner pages come in its next parts («أساس»'s meanwhile).
  [SHABE_STORE_KEY]: { Frame: ShabeFrame, Home: ShabeHome, Canvas: ShabeCanvas, pages: ASAS_PAGES },
};

/** Every store theme this front end draws (the Builder's registry must list the same). */
export const STORE_THEME_KEYS = Object.keys(STORE_THEMES);

/** The theme of a store (the free «أساس» for a key this front end doesn't know). */
export function storeTheme(key: string | null | undefined): StoreTheme {
  return (key ? STORE_THEMES[key] : undefined) ?? STORE_THEMES[ASAS_KEY];
}
