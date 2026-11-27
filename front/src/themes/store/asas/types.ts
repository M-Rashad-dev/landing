/** «أساس» design: its home sections (back end: App\Themes\Store\AsasStoreDesign). The base settings and data are in ../shared/types. */
import type { AiSectionProps } from "../../shared/ai-section/types";
import type { StoreSettings } from "../shared/types";

export const ASAS_KEY = "asas_store";

export type IconKey = "truck" | "cash" | "return" | "shield" | "support" | "gift" | "star" | "clock" | "tag" | "heart" | "package" | "phone";
/** «search»: the store's search for a word (its `url` holds the word). */
export type LinkType = "none" | "all_products" | "offers" | "category" | "product" | "url" | "search";

export type Slide = { media_id: number; title: string | null; text: string | null; button_label: string | null; link: { type: LinkType; target_id: number | null; url: string | null } };

export type BannerProps = { slides: Slide[]; autoplay: boolean };
export type ProductsProps = { title: string; description: string | null; source: "latest" | "offers" | "category"; category_id: number | null; limit: number; layout: "grid" | "slider"; columns: number; show_view_all: boolean };
export type FeaturesProps = { title: string | null; items: Array<{ icon: IconKey; title: string; text: string | null }> };
export type TestimonialsProps = { title: string | null; source: "auto" | "manual"; items: Array<{ name: string; rating: number; text: string }>; /** «صوفي»: a slider (default) or a grid, on every screen. */ layout?: "slider" | "list" };

export type Section =
  | { id: string; type: "banner"; visible: boolean; props: BannerProps }
  | { id: string; type: "products"; visible: boolean; props: ProductsProps }
  | { id: string; type: "features"; visible: boolean; props: FeaturesProps }
  | { id: string; type: "testimonials"; visible: boolean; props: TestimonialsProps }
  | { id: string; type: "ai"; visible: boolean; props: AiSectionProps };
export type SectionType = Section["type"];

export type Design = { settings: StoreSettings; sections: Section[] };

export const ICON_KEYS: IconKey[] = ["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone"];
export const PRODUCT_LIMITS = [4, 8, 12, 16, 24, 32] as const;
export const COLUMNS = [2, 3, 4, 5] as const;
