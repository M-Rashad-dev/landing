/** «رواق» design (back end: App\Themes\Store\RawaqStoreDesign). Library sections share their props with «صوفي» and «أساس». */
import type { AiSectionProps } from "@/themes/shared/ai-section/types";
import type { FeaturesProps, ProductsProps, TestimonialsProps } from "../asas/types";
import type { DesignData, StoreSettings } from "../shared/types";
import type { BannersProps, BrandsProps, CategoriesProps, CategoryTile, CountdownProps, FaqProps, Link, TabsProps, VideoProps } from "../sufi/types";

export const RAWAQ_KEY = "rawaq_store";

export type ButtonShape = "rounded" | "pill" | "square";

/** The product card (back end: RawaqStoreDesign::CARD_DEFAULTS). */
export type RawaqCardSettings = {
  image: "square" | "tall";
  /** The picture on a soft plate of the theme's color. */
  tinted: boolean;
  show_description: boolean;
  show_rating: boolean;
  button: "icon" | "full";
  /** Corner roundness in px. */
  radius: number;
};

export const RAWAQ_CARD_DEFAULTS: RawaqCardSettings = { image: "square", tinted: true, show_description: false, show_rating: true, button: "full", radius: 22 };

export type RawaqSettings = Omit<StoreSettings, "colors" | "header" | "footer" | "general"> & {
  colors: StoreSettings["colors"] & { dark: string };
  display_font: boolean;
  button: ButtonShape;
  header: StoreSettings["header"] & { layout: "start" | "center"; categories_menu: boolean };
  footer: StoreSettings["footer"] & { dark: boolean; payments: boolean };
  general: StoreSettings["general"] & { floating_call: boolean; call_phone: string | null; animations: boolean };
  /** Missing in designs saved before it (read with its defaults). */
  product_card?: RawaqCardSettings;
};

export type GlowHeroProps = {
  kicker: string | null;
  title: string;
  /** A word of the title drawn in the theme's color. */
  highlight: string | null;
  subtitle: string | null;
  media_id: number | null;
  badge: string | null;
  /** «4.9 من 2,300 عميلة» on a small card over the picture. */
  rating: string | null;
  primary_label: string;
  primary_link: Link;
  second_label: string | null;
  second_link: Link;
  chips: string[];
};

/** One tile of «اختصارات»: a skin type, a concern… opening a category, a product or any link. */
export type Shortcut = { label: string; text: string | null; media_id: number | null; color: string | null; link: Link };
export type ShortcutsProps = { kicker: string | null; title: string | null; description: string | null; style: "circles" | "cards"; items: Shortcut[] };

export type RoutineStep = { product_id: number; label: string | null; hint: string | null };
export type RoutineProps = { kicker: string | null; title: string; text: string | null; button_label: string | null; steps: RoutineStep[] };

export type Reel = { url: string; title: string | null; cover_media_id: number | null };
export type ReelsProps = { kicker: string | null; title: string | null; items: Reel[] };

export type Ingredient = { symbol: string; name: string; text: string | null; color: string | null; link: Link };
export type IngredientsProps = { kicker: string | null; title: string | null; description: string | null; items: Ingredient[] };

export type CtaProps = { title: string; text: string | null; button_label: string; action: "whatsapp" | "link"; message: string | null; link: Link };

type S<T extends string, P> = { id: string; type: T; visible: boolean; props: P };
export type RawaqSection =
  | S<"glow_hero", GlowHeroProps>
  | S<"features", FeaturesProps>
  | S<"shortcuts", ShortcutsProps>
  | S<"categories", CategoriesProps>
  | S<"product_tabs", TabsProps>
  | S<"products", ProductsProps>
  | S<"routine", RoutineProps>
  | S<"banners", BannersProps>
  | S<"countdown", CountdownProps>
  | S<"reels", ReelsProps>
  | S<"video", VideoProps>
  | S<"ingredients", IngredientsProps>
  | S<"brands", BrandsProps>
  | S<"testimonials", TestimonialsProps>
  | S<"faq", FaqProps>
  | S<"cta", CtaProps>
  | S<"ai", AiSectionProps>;
export type RawaqSectionType = RawaqSection["type"];

export type RawaqDesign = { settings: RawaqSettings; sections: RawaqSection[] };

export type RawaqData = DesignData & { category_tiles?: Record<string, CategoryTile[]> };
