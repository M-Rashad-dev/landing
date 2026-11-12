/** «أساس» design and the data its sections show (back end: App\Store\Design\AsasDesign, StoreDesigner::data). */

export type FontKey = "cairo" | "tajawal" | "almarai" | "ibm_plex_arabic" | "noto_kufi" | "readex_pro";
export type FontSize = "small" | "medium" | "large";
export type Social = "facebook" | "instagram" | "tiktok" | "x" | "youtube" | "snapchat";
export type IconKey = "truck" | "cash" | "return" | "shield" | "support" | "gift" | "star" | "clock" | "tag" | "heart" | "package" | "phone";
export type LinkType = "none" | "all_products" | "offers" | "category" | "product" | "url";

export type Colors = { primary: string; secondary: string; background: string; text: string };

export type Settings = {
  colors: Colors;
  font: FontKey;
  font_size: FontSize;
  logo_media_id: number | null;
  favicon_media_id: number | null;
  header: { sticky: boolean; search: boolean; announcement: string | null };
  footer: { about: string | null; show_pages: boolean; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; social: Record<Social, string | null> };
  general: { whatsapp_button: boolean; show_out_of_stock: boolean; products_per_page: number };
};

export type Slide = { media_id: number; title: string | null; text: string | null; button_label: string | null; link: { type: LinkType; target_id: number | null; url: string | null } };

export type BannerProps = { slides: Slide[]; autoplay: boolean };
export type ProductsProps = { title: string; description: string | null; source: "latest" | "offers" | "category"; category_id: number | null; limit: number; layout: "grid" | "slider"; columns: number; show_view_all: boolean };
export type FeaturesProps = { title: string | null; items: Array<{ icon: IconKey; title: string; text: string | null }> };
export type TestimonialsProps = { title: string | null; source: "auto" | "manual"; items: Array<{ name: string; rating: number; text: string }> };

export type Section =
  | { id: string; type: "banner"; visible: boolean; props: BannerProps }
  | { id: string; type: "products"; visible: boolean; props: ProductsProps }
  | { id: string; type: "features"; visible: boolean; props: FeaturesProps }
  | { id: string; type: "testimonials"; visible: boolean; props: TestimonialsProps };
export type SectionType = Section["type"];

export type Design = { settings: Settings; sections: Section[] };

export type MediaUrls = Record<string, string>;

/** The best size of an image for a place (falls back to any size the image has). */
export function pick(urls: MediaUrls | null | undefined, size: "thumb" | "medium" | "large"): string | null {
  if (!urls) return null;
  return urls[size] ?? urls.large ?? urls.medium ?? urls.thumb ?? Object.values(urls)[0] ?? null;
}

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  discount_percent: number | null;
  image: { id: number; alt: string | null; width: number | null; height: number | null; urls: Record<string, string> } | null;
  available: boolean;
  needs_options: boolean;
  /** Units in stock (null: no limit, or chosen per option on the product page). */
  max_quantity?: number | null;
  /** Visible reviews (null: none yet). */
  rating?: { average: number; count: number } | null;
};

export type DesignData = {
  products: Record<string, ProductCard[]>;
  view_all: Record<string, string | null>;
  links: Record<string, string | null>;
  media: Record<string, MediaUrls>;
  categories: Array<{ id: number; parent_id: number | null; name: string; slug: string }>;
  pages: Array<{ title: string; slug: string }>;
  reviews: Array<{ name: string; rating: number; text: string }>;
};

export const FONTS: Record<FontKey, { label: string; family: string; google: string }> = {
  cairo: { label: "Cairo", family: "Cairo", google: "Cairo:wght@400;600;700;800" },
  tajawal: { label: "تجوال", family: "Tajawal", google: "Tajawal:wght@400;500;700;800" },
  almarai: { label: "Almarai", family: "Almarai", google: "Almarai:wght@400;700;800" },
  ibm_plex_arabic: { label: "IBM Plex Sans Arabic", family: "IBM Plex Sans Arabic", google: "IBM+Plex+Sans+Arabic:wght@400;500;600;700" },
  noto_kufi: { label: "Noto Kufi Arabic", family: "Noto Kufi Arabic", google: "Noto+Kufi+Arabic:wght@400;600;700;800" },
  readex_pro: { label: "Readex Pro", family: "Readex Pro", google: "Readex+Pro:wght@400;500;600;700" },
};

export const FONT_SCALE: Record<FontSize, number> = { small: 0.92, medium: 1, large: 1.1 };

/** Ready color sets (the first one is «نعناع», the default). */
export const PALETTES: Array<{ key: string; colors: Colors }> = [
  { key: "mint", colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" } },
  { key: "sea", colors: { primary: "#1d4ed8", secondary: "#f59e0b", background: "#ffffff", text: "#0f172a" } },
  { key: "rose", colors: { primary: "#db2777", secondary: "#fbbf24", background: "#fff7fb", text: "#3b0a24" } },
  { key: "coffee", colors: { primary: "#7c4a2d", secondary: "#e7b75f", background: "#fbf7f2", text: "#2b1b12" } },
  { key: "night", colors: { primary: "#a78bfa", secondary: "#f472b6", background: "#0f0f1a", text: "#f4f4f5" } },
  { key: "mono", colors: { primary: "#111827", secondary: "#ef4444", background: "#ffffff", text: "#111827" } },
];

export const ICON_KEYS: IconKey[] = ["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone"];
export const SOCIALS: Social[] = ["facebook", "instagram", "tiktok", "x", "youtube", "snapchat"];
export const PRODUCT_LIMITS = [4, 8, 12, 16, 24, 32] as const;
export const COLUMNS = [2, 3, 4, 5] as const;
export const PER_PAGE = [12, 16, 24, 32, 48] as const;

/** Text on a colored background: dark or light, whichever reads better. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#111111" : "#ffffff";
}
