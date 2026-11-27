/**
 * What every store theme shares: the base settings (back end: AsasStoreDesign's shared rules,
 * which every store theme extends), the data the server sends with a design (StoreDesigner::data)
 * and product cards. Fonts, colors and image sizes are shared with landing themes (../../shared/design).
 * A theme's own sections and extra settings live in its folder.
 */
import type { AiCategoryTile, AiDefinition } from "../../shared/ai-section/types";
import type { Colors, FontKey, FontSize, MediaUrls, Social } from "../../shared/design";

export type StoreSettings = {
  colors: Colors;
  font: FontKey;
  font_size: FontSize;
  logo_media_id: number | null;
  favicon_media_id: number | null;
  header: { sticky: boolean; search: boolean; announcement: string | null };
  footer: { about: string | null; show_pages: boolean; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; social: Record<Social, string | null> };
  general: { whatsapp_button: boolean; show_out_of_stock: boolean; products_per_page: number };
};

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
  /** A digital product (prepaid, delivered by email). */
  digital?: boolean;
  /** Units in stock (null: no limit, or chosen per option on the product page). */
  max_quantity?: number | null;
  /** Visible reviews (null: none yet). */
  rating?: { average: number; count: number } | null;
  /** Values of the spec rows flagged «يظهر في كارت المنتج» (≤ 4; missing on older cached pages). */
  spec_chips?: string[];
};

export type DesignData = {
  products: Record<string, ProductCard[]>;
  view_all: Record<string, string | null>;
  links: Record<string, string | null>;
  media: Record<string, MediaUrls>;
  categories: Array<{ id: number; parent_id: number | null; name: string; slug: string }>;
  pages: Array<{ title: string; slug: string }>;
  reviews: Array<{ name: string; rating: number; text: string }>;
  category_tiles?: Record<string, AiCategoryTile[]>;
  ai_sections?: Record<string, AiDefinition>;
  ai_sections_current?: Record<string, number>;
};

export const PER_PAGE = [12, 16, 24, 32, 48] as const;

