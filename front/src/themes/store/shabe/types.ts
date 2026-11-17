/** «شابع · متجر» design (back end: App\Themes\Store\ShabeStoreDesign). Library sections share their props with «صوفي». */
import type { ProductOffer } from "@/lib/store/types";
import type { ProductsProps, TestimonialsProps } from "../asas/types";
import type { DesignData, ProductCard, StoreSettings } from "../shared/types";
import type { CategoriesProps, CategoryTile, CountdownProps, FaqProps, GalleryProps, Link, LocationProps, MarqueeProps, TabsProps, VideoProps } from "../sufi/types";

export const SHABE_STORE_KEY = "shabe_store";

export type FoodIcon =
  | "truck" | "cash" | "return" | "shield" | "support" | "gift" | "star" | "clock" | "tag" | "heart" | "package" | "phone"
  | "flame" | "chef" | "leaf" | "utensils" | "meat" | "timer" | "thermo" | "bike" | "soup" | "sparkle";

export type ButtonShape = "rounded" | "pill" | "square";

/** The product card (back end: ShabeStoreDesign::CARD_DEFAULTS). */
export type CardSettings = {
  image: "square" | "wide" | "circle";
  show_description: boolean;
  show_rating: boolean;
  button: "icon" | "full";
  /** 0 = no border. */
  border_width: number;
  /** null: the theme's own line color. */
  border_color: string | null;
  /** Corner roundness in px. */
  radius: number;
  shadow: boolean;
};

/** The product page (back end: ShabeStoreDesign::PAGE_DEFAULTS). */
export type PageSettings = {
  gallery: "thumbs" | "slider";
  zoom: boolean;
  description: boolean;
  reviews: boolean;
  whatsapp_ask: boolean;
  related_enabled: boolean;
  related: "category" | "similar";
  sticky_bar: boolean;
  sticky_buttons: "cart" | "both" | "buy";
  viewers: { enabled: boolean; min: number; max: number; every: number };
};

export const CARD_DEFAULTS: CardSettings = { image: "square", show_description: true, show_rating: true, button: "icon", border_width: 1, border_color: null, radius: 24, shadow: false };
export const PAGE_DEFAULTS: PageSettings = {
  gallery: "thumbs",
  zoom: true,
  description: true,
  reviews: true,
  whatsapp_ask: true,
  related_enabled: true,
  related: "category",
  sticky_bar: true,
  sticky_buttons: "both",
  viewers: { enabled: false, min: 300, max: 600, every: 15 },
};

export type ShabeStoreSettings = Omit<StoreSettings, "colors" | "header" | "footer" | "general"> & {
  colors: StoreSettings["colors"] & { dark: string };
  display_font: boolean;
  button: ButtonShape;
  header: StoreSettings["header"] & { layout: "start" | "center"; countdown_ends_at: string | null; hotline: string | null; button_label: string | null; button_link: Link; categories_menu: boolean };
  footer: StoreSettings["footer"] & { dark: boolean; payments: boolean };
  general: StoreSettings["general"] & { floating_call: boolean; call_phone: string | null; animations: boolean };
  /** Missing in designs saved before them (read with their defaults). */
  product_card?: CardSettings;
  product_page?: PageSettings;
};

type IconItem = { icon: FoodIcon; title: string; text: string | null };

export type FoodHeroProps = {
  kicker: string | null;
  title: string;
  highlight: string | null;
  subtitle: string | null;
  media_id: number | null;
  stickers: string[];
  badge: string | null;
  primary_label: string;
  primary_link: Link;
  second_label: string | null;
  second_link: Link;
  trust: Array<{ icon: FoodIcon; text: string }>;
};
export type WhyProps = { kicker: string | null; title: string | null; subtitle: string | null; media_id: number | null; quote: string | null; items: IconItem[] };
export type StepsProps = { kicker: string | null; title: string | null; items: IconItem[] };
export type BundleCard = { offer_id: number; media_id: number | null; title: string; subtitle: string | null; points: string[]; ribbon: string | null; button_label: string | null };
export type BundlesProps = { kicker: string | null; title: string | null; subtitle: string | null; cards: BundleCard[] };
/** One row per day, Saturday first; times "HH:MM" in Cairo time (a "to" before "from" ends after midnight). */
export type HoursDay = { open: boolean; from: string; to: string };
export type HoursProps = { title: string | null; subtitle: string | null; days: HoursDay[]; open_message: string; closed_message: string };

type S<T extends string, P> = { id: string; type: T; visible: boolean; props: P };
export type ShabeStoreSection =
  | S<"food_hero", FoodHeroProps>
  | S<"marquee", MarqueeProps>
  | S<"categories", CategoriesProps>
  | S<"product_tabs", TabsProps>
  | S<"bundles", BundlesProps>
  | S<"products", ProductsProps>
  | S<"why", WhyProps>
  | S<"steps", StepsProps>
  | S<"countdown", CountdownProps>
  | S<"video", VideoProps>
  | S<"gallery", GalleryProps>
  | S<"testimonials", TestimonialsProps>
  | S<"hours", HoursProps>
  | S<"faq", FaqProps>
  | S<"location", LocationProps>;
export type ShabeStoreSectionType = ShabeStoreSection["type"];

export type ShabeStoreDesign = { settings: ShabeStoreSettings; sections: ShabeStoreSection[] };

/** A pack card's offer as the server sends it (null: the offer can't be offered now). */
export type BundleData = { offer: ProductOffer; product: ProductCard | null; href: string } | null;

export type ShabeStoreData = DesignData & {
  category_tiles?: Record<string, CategoryTile[]>;
  bundles?: Record<string, BundleData[]>;
};
