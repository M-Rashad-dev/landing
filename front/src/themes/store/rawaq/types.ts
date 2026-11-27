/** «رواق» design (back end: App\Themes\Store\RawaqStoreDesign). Library sections share their props with «صوفي» and «أساس». */
import type { AiSectionProps } from "@/themes/shared/ai-section/types";
import type { FeaturesProps, ProductsProps, TestimonialsProps } from "../asas/types";
import type { DesignData, ProductCard, StoreSettings } from "../shared/types";
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

/** The product page (back end: RawaqStoreDesign::PAGE_DEFAULTS). */
export type RawaqPageSettings = {
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
  /** Short promises under the buttons («أصلي 100%»…), up to 4. */
  promises: string[];
};

/** Category, all-products and offers pages (back end: RawaqStoreDesign::LISTING_DEFAULTS). */
export type RawaqListingSettings = { columns_desktop: number; columns_mobile: number; banner: boolean; subcategories: "circles" | "chips"; filters: "open" | "button" | "hidden" };

/** The cart (back end: RawaqStoreDesign::CART_DEFAULTS). */
export type RawaqCartSettings = { free_shipping_bar: boolean; suggestions_enabled: boolean; suggestions: "offers" | "latest"; order_notes: boolean };

export const RAWAQ_PAGE_DEFAULTS: RawaqPageSettings = {
  gallery: "thumbs",
  zoom: true,
  description: true,
  reviews: true,
  whatsapp_ask: true,
  related_enabled: true,
  related: "similar",
  sticky_bar: true,
  sticky_buttons: "cart",
  viewers: { enabled: false, min: 40, max: 120, every: 15 },
  promises: ["أصلي 100%", "الدفع عند الاستلام", "استبدال سهل"],
};
export const RAWAQ_LISTING_DEFAULTS: RawaqListingSettings = { columns_desktop: 4, columns_mobile: 2, banner: true, subcategories: "circles", filters: "button" };
export const RAWAQ_CART_DEFAULTS: RawaqCartSettings = { free_shipping_bar: true, suggestions_enabled: true, suggestions: "offers", order_notes: false };

export type RawaqSettings = Omit<StoreSettings, "colors" | "header" | "footer" | "general"> & {
  colors: StoreSettings["colors"] & { dark: string };
  display_font: boolean;
  button: ButtonShape;
  header: StoreSettings["header"] & { layout: "start" | "center"; categories_menu: boolean };
  footer: StoreSettings["footer"] & { dark: boolean; payments: boolean };
  general: StoreSettings["general"] & { floating_call: boolean; call_phone: string | null; animations: boolean };
  /** Missing in designs saved before them (read with their defaults). */
  product_card?: RawaqCardSettings;
  product_page?: RawaqPageSettings;
  listing?: RawaqListingSettings;
  cart?: RawaqCartSettings;
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

export type BeforeAfterProps = {
  kicker: string | null;
  title: string | null;
  text: string | null;
  /** Required to save (null only in a section just added in the Builder). */
  before_media_id: number | null;
  after_media_id: number | null;
  before_label: string;
  after_label: string;
  facts: Array<{ value: string; label: string }>;
};

/** One result of «اختبار البشرة»: what it says and what it recommends (products and / or a category). */
export type QuizResult = { id: string; name: string; text: string | null; product_ids: number[]; category_id: number | null };
/** An answer counts for one or two results (by id). */
export type QuizAnswer = { text: string; results: string[] };
export type QuizQuestion = { text: string; answers: QuizAnswer[] };
/** The AI add-on (back end: StoreSections::QUIZ_AI_DEFAULTS): the AI picks the result and the store's products, paid by the merchant. */
export type QuizAi = { enabled: boolean; open_question: boolean; open_label: string | null; scope: "all" | "categories" | "products"; category_ids: number[]; product_ids: number[] };
export const QUIZ_AI_DEFAULTS: QuizAi = { enabled: false, open_question: true, open_label: null, scope: "all", category_ids: [], product_ids: [] };
/** Missing `ai` in quizzes saved before the add-on (read as off). */
export type SkinQuizProps = { kicker: string | null; title: string; text: string | null; button_label: string | null; results: QuizResult[]; questions: QuizQuestion[]; ai?: QuizAi };

/** A tip: a card that opens its own text in a reader, or a link. */
export type Article = { media_id: number | null; tag: string | null; title: string; body: string | null; link: Link };
export type ArticlesProps = { kicker: string | null; title: string | null; items: Article[] };

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
  | S<"before_after", BeforeAfterProps>
  | S<"skin_quiz", SkinQuizProps>
  | S<"articles", ArticlesProps>
  | S<"ai", AiSectionProps>;
export type RawaqSectionType = RawaqSection["type"];

export type RawaqDesign = { settings: RawaqSettings; sections: RawaqSection[] };

export type RawaqData = DesignData & {
  category_tiles?: Record<string, CategoryTile[]>;
  /** The cart's suggestions (offers or newest), when the merchant turned them on. */
  cart_products?: ProductCard[];
};
