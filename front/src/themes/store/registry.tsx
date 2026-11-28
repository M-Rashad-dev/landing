import type * as React from "react";
import type { StoreConfig } from "@/lib/store/types";
import { asasAiTokens, rawaqStoreAiTokens, shabeStoreAiTokens, sufiStoreAiTokens, teknoStoreAiTokens } from "@/themes/shared/ai-section/tokens";
import type { AiTokens } from "@/themes/shared/ai-section/types";
import { AsasFrame, AsasStore, HomeSections, type Selection } from "./asas/asas-store";
import { AccountView, MyOrderView, SignInView } from "./asas/pages/account";
import { CartView } from "./asas/pages/cart";
import { CheckoutView } from "./asas/pages/checkout";
import { CompareView } from "./asas/pages/compare";
import { OrderDone, StaticPageView, StoreNotFound } from "./asas/pages/info";
import { Listing } from "./asas/pages/listing";
import { ProductView } from "./asas/pages/product";
import { TrackView } from "./asas/pages/track";
import { WishlistView } from "./asas/pages/wishlist";
import { ASAS_KEY, type Design } from "./asas/types";
import { RawaqCartView } from "./rawaq/pages/cart";
import { RawaqCheckoutView } from "./rawaq/pages/checkout";
import { RawaqOrderDone } from "./rawaq/pages/done";
import { RawaqListing } from "./rawaq/pages/listing";
import { RawaqProductView } from "./rawaq/pages/product";
import { RawaqCard } from "./rawaq/card";
import { RawaqFrame, RawaqHomeSections, RawaqStore } from "./rawaq/rawaq-store";
import { RAWAQ_KEY, type RawaqDesign, type RawaqSection } from "./rawaq/types";
import type { ThemeMode } from "./shared/context";
import type { DesignData } from "./shared/types";
import { ShabeCartView } from "./shabe/pages/cart";
import { ShabeCheckoutView } from "./shabe/pages/checkout";
import { ShabeOrderDone } from "./shabe/pages/done";
import { ShabeListing } from "./shabe/pages/listing";
import { ShabeProductView } from "./shabe/pages/product";
import { FoodCard } from "./shabe/card";
import { ShabeFrame, ShabeHomeSections, ShabeStore } from "./shabe/shabe-store";
import { SHABE_STORE_KEY, type ShabeStoreDesign, type ShabeStoreSection } from "./shabe/types";
import { SufiFrame, SufiHomeSections, SufiStore } from "./sufi/sufi-store";
import { SUFI_KEY, type Scheme, type SufiDesign, type SufiSection } from "./sufi/types";
import { TeknoCard } from "./tekno/card";
import { TeknoFrame, TeknoHomeSections, TeknoStore } from "./tekno/tekno-store";
import { TEKNO_KEY, type TeknoDesign, type TeknoSection } from "./tekno/types";

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
  /** «قارن» and «المفضلة» (lists in the visitor's browser); a theme may pass its own card to the wishlist. */
  Compare: CompareView,
  Wishlist: WishlistView as React.ComponentType,
};

function RawaqWishlist() {
  return <WishlistView Card={RawaqCard} />;
}

function ShabeWishlist() {
  return <WishlistView Card={FoodCard} />;
}

function TeknoWishlist() {
  return <WishlistView Card={TeknoCard} />;
}

export type StoreTheme = {
  /** Header, the page and footer around every live page. */
  Frame: React.ComponentType<{ config: StoreConfig; children: React.ReactNode }>;
  /** The home sections of the live store (inside the frame). */
  Home: React.ComponentType<{ config: StoreConfig }>;
  Canvas: React.ComponentType<CanvasProps>;
  pages: typeof ASAS_PAGES;
  aiTokens: (settings: unknown, scheme?: Scheme) => AiTokens;
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

function RawaqHome({ config }: { config: StoreConfig }) {
  return <RawaqHomeSections sections={config.design.sections as unknown as RawaqSection[]} />;
}

function RawaqCanvas({ design, scheme: _scheme, ...rest }: CanvasProps) {
  void _scheme;
  return <RawaqStore design={design as RawaqDesign} {...rest} />;
}

function TeknoHome({ config }: { config: StoreConfig }) {
  return <TeknoHomeSections sections={config.design.sections as unknown as TeknoSection[]} />;
}

function TeknoCanvas({ design, scheme: _scheme, ...rest }: CanvasProps) {
  void _scheme;
  return <TeknoStore design={design as TeknoDesign} {...rest} />;
}

/**
 * Every store theme by key: what the live store, the Builder and the preview draw. A new store
 * theme is added here once (its frame, home, canvas and pages); nothing else picks by key.
 */
const STORE_THEMES: Record<string, StoreTheme> = {
  [ASAS_KEY]: { Frame: AsasFrame, Home: AsasHome, Canvas: AsasCanvas, pages: ASAS_PAGES, aiTokens: (s) => asasAiTokens(s) },
  // «صوفي» draws its own frame and home; its inner pages are «أساس»'s in its colors (for now).
  [SUFI_KEY]: { Frame: SufiFrame, Home: SufiHome, Canvas: SufiCanvas, pages: ASAS_PAGES, aiTokens: sufiStoreAiTokens },
  // «شابع · متجر»: its own frame, home and shopping pages; account, tracking and static pages are the shared ones in its colors.
  // «رواق»: its own frame, home and shopping pages; account, tracking and static pages are the shared ones in its colors.
  [RAWAQ_KEY]: { Frame: RawaqFrame, Home: RawaqHome, Canvas: RawaqCanvas, pages: { ...ASAS_PAGES, Product: RawaqProductView, Listing: RawaqListing, Cart: RawaqCartView, Checkout: RawaqCheckoutView, OrderDone: RawaqOrderDone, Wishlist: RawaqWishlist }, aiTokens: (s) => rawaqStoreAiTokens(s) },
  // «تيكنو» (being built, docs/plans/tekno): its frame, home and card now; its shopping pages come in stage T2.
  [TEKNO_KEY]: { Frame: TeknoFrame, Home: TeknoHome, Canvas: TeknoCanvas, pages: { ...ASAS_PAGES, Wishlist: TeknoWishlist }, aiTokens: (s) => teknoStoreAiTokens(s) },
  [SHABE_STORE_KEY]: { Frame: ShabeFrame, Home: ShabeHome, Canvas: ShabeCanvas, pages: { ...ASAS_PAGES, Product: ShabeProductView, Listing: ShabeListing, Cart: ShabeCartView, Checkout: ShabeCheckoutView, OrderDone: ShabeOrderDone, Wishlist: ShabeWishlist }, aiTokens: (s) => shabeStoreAiTokens(s) },
};

/** Every store theme this front end draws (the Builder's registry must list the same). */
export const STORE_THEME_KEYS = Object.keys(STORE_THEMES);

/** The theme of a store (the free «أساس» for a key this front end doesn't know). */
export function storeTheme(key: string | null | undefined): StoreTheme {
  return (key ? STORE_THEMES[key] : undefined) ?? STORE_THEMES[ASAS_KEY];
}
