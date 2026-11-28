/** «تيكنو» design (back end: App\Themes\Store\TeknoStoreDesign). Library sections share their props with «صوفي» and «أساس». */
import type { AiSectionProps } from "@/themes/shared/ai-section/types";
import type { FeaturesProps, ProductsProps, TestimonialsProps } from "../asas/types";
import type { CtaProps } from "../rawaq/types";
import type { DesignData, StoreSettings } from "../shared/types";
import type { BannersProps, BrandsProps, CategoriesProps, CategoryTile, CountdownProps, FaqProps, Link, TabsProps, VideoProps } from "../sufi/types";

export const TEKNO_KEY = "tekno_store";

export type ButtonShape = "rounded" | "pill" | "square";

/** The icons of «تيكنو»'s trust strip and services (back end: StoreSections::TECH_ICONS). */
export type TechIcon = FeaturesProps["items"][number]["icon"] | "wrench" | "headset" | "badge-check";
export const TECH_ICON_KEYS: TechIcon[] = ["badge-check", "shield", "return", "tag", "truck", "cash", "wrench", "headset", "support", "gift", "star", "clock", "heart", "package", "phone"];

/** The product card (back end: TeknoStoreDesign::CARD_DEFAULTS). */
export type TeknoCardSettings = {
  /** The spec chips under the name. */
  show_specs: boolean;
  /** «قارن» on the picture. */
  show_compare: boolean;
  show_rating: boolean;
  /** «أو X ج/شهر» under the price (when installments are on). */
  show_installment: boolean;
  /** «فاضل N بس» from this many units down (0: never). */
  low_stock: number;
  /** The spec row drawn as a dark badge on the picture («الحالة»: جديد / كسر زيرو…); null: none. */
  badge_label: string | null;
  radius: number;
};

export const TEKNO_CARD_DEFAULTS: TeknoCardSettings = { show_specs: true, show_compare: true, show_rating: true, show_installment: true, low_stock: 5, badge_label: null, radius: 16 };

/** «التقسيط»: shown, never a way to pay (back end: TeknoStoreDesign::INSTALLMENTS_DEFAULTS). */
export type TeknoInstallments = {
  enabled: boolean;
  months: number[];
  /** The months a card and the hero show. */
  card_months: number;
  /** 0 = «بدون فوايد». */
  interest_percent: number;
  /** From this price up (pounds). */
  min_price: number;
  providers: string[];
  note: string | null;
};

export const INSTALLMENT_MONTHS = [3, 6, 9, 12, 18, 24, 36] as const;

/** «قايمة الأقسام الكبيرة»: a category of the side list, its link columns and its promo card. */
export type MegaLink = { label: string; link: Link };
export type MegaColumn = { title: string; links: MegaLink[] };
export type MegaPromo = { media_id: number | null; title: string; text: string | null; link: Link };
export type MegaItem = { category_id: number; columns: MegaColumn[]; promo: MegaPromo | null };
export type TeknoMegaMenu = { enabled: boolean; items: MegaItem[] };

export type TeknoSettings = Omit<StoreSettings, "colors" | "header" | "footer"> & {
  colors: StoreSettings["colors"] & { dark: string; deal: string };
  display_font: boolean;
  button: ButtonShape;
  header: StoreSettings["header"] & { hotline: string | null; track_link: boolean; search_categories: boolean };
  /** `help_links`: the store pages of «المساعدة» (none: the store's pages). */
  footer: StoreSettings["footer"] & { help_links: number[] };
  mega_menu: TeknoMegaMenu;
  product_card: TeknoCardSettings;
  installments: TeknoInstallments;
};

/** One slide of the opening: a product picked gives its real price and installment line. */
export type HeroSlide = {
  kicker: string | null;
  title: string;
  /** A word of the title in cyan. */
  highlight: string | null;
  subtitle: string | null;
  media_id: number | null;
  chips: string[];
  product_id: number | null;
  button_label: string;
  link: Link;
  second_label: string | null;
  second_link: Link;
};
export type HeroTile = { media_id: number | null; kicker: string | null; title: string; text: string | null; color: string | null; link: Link };
export type TechHeroProps = { slides: HeroSlide[]; tiles: HeroTile[] };

/** «عرض اليوم»: one product with a timer to midnight in Cairo (or a date) and the stock bar. */
export type DealOfDayProps = {
  kicker: string | null;
  /** Required to save (null only in a section just added in the Builder). */
  product_id: number | null;
  /** null: the product's name. */
  title: string | null;
  /** null: the product's card chips. */
  chips: string[] | null;
  ends: "midnight" | "date";
  ends_at: string | null;
  /** The quantity at the start of the offer (the bar «اتباع X%» needs it). */
  stock_start: number | null;
  button_label: string;
  show_installment: boolean;
};

export type ServicesProps = { title: string | null; items: Array<{ icon: TechIcon; title: string; text: string | null }> };

/** «تيكنو» extends three library types: 5 trust items with its icons, a kicker on the tabs, the product on a written review. */
export type TeknoFeaturesProps = { title: string | null; items: Array<{ icon: TechIcon; title: string; text: string | null }> };
export type TeknoTabsProps = TabsProps & { kicker: string | null };
export type TeknoTestimonialsProps = Omit<TestimonialsProps, "items"> & { items: Array<{ name: string; rating: number; text: string; product: string | null }> };

type S<T extends string, P> = { id: string; type: T; visible: boolean; props: P };
export type TeknoSection =
  | S<"tech_hero", TechHeroProps>
  | S<"features", TeknoFeaturesProps>
  | S<"categories", CategoriesProps>
  | S<"deal_of_day", DealOfDayProps>
  | S<"product_tabs", TeknoTabsProps>
  | S<"products", ProductsProps>
  | S<"banners", BannersProps>
  | S<"countdown", CountdownProps>
  | S<"video", VideoProps>
  | S<"brands", BrandsProps>
  | S<"services", ServicesProps>
  | S<"testimonials", TeknoTestimonialsProps>
  | S<"faq", FaqProps>
  | S<"cta", CtaProps>
  | S<"ai", AiSectionProps>;
export type TeknoSectionType = TeknoSection["type"];

export type TeknoDesign = { settings: TeknoSettings; sections: TeknoSection[] };

export type TeknoData = DesignData & { category_tiles?: Record<string, CategoryTile[]> };
