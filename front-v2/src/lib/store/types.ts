/**
 * What the public store API returns (back end: App\Store\StoreSite, StoreCatalog, PublicProductResource,
 * PriceCalculator / CartQuote, TrackController). Shared by the server loaders and the storefront.
 */
import type { Tracking } from "@/lib/tracking/ids";
import type { Design, DesignData, ProductCard } from "@/themes/asas/types";

export type StoreImage = { id: number; alt: string | null; width: number | null; height: number | null; urls: Record<string, string> };

export type Seo = { title?: string | null; description?: string | null; keywords?: string[] | null; noindex?: boolean | null } | null;

export type StoreCategory = {
  id: number;
  parent_id: number | null;
  depth: number;
  name: string;
  slug: string;
  description: string | null;
  image: StoreImage | null;
  products_count: number;
  seo: Seo;
};

export type ShippingConfig =
  | { enabled: false }
  | {
      enabled: true;
      fees: Record<string, number>;
      unavailable: string[];
      free_over: number | null;
    };

export type StoreConfig = {
  theme_key: string;
  design: Design;
  data: DesignData;
  store_name: string;
  categories: StoreCategory[];
  pages: Array<{ title: string; slug: string }>;
  seo: { title: string; description: string; canonical: string; site_name: string };
  tracking: Tracking | null;
  shipping: ShippingConfig;
  branding: boolean;
  primary_host: string;
};

export type ProductOption = {
  id: number;
  name: string;
  display_type: "buttons" | "dropdown" | "swatch";
  is_required: boolean;
  values: Array<{ id: number; label: string; color_hex: string | null; price_delta: number }>;
};

export type StoreProduct = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  available: boolean;
  stock_mode: "unlimited" | "product" | "variant";
  stock: number | null;
  /** Units per combination key ("12-40": the chosen value ids of the required options, sorted). */
  variant_stock: Record<string, number> | null;
  images: StoreImage[];
  options: ProductOption[];
};

export type ProductOffer = {
  id: number;
  name: string;
  type: "percentage" | "fixed" | "bundle" | "buy_get" | "gift";
  value: number | null;
  min_quantity: number | null;
  free_quantity: number | null;
  required_quantity: number;
  gift: { id: number; name: string; price: number } | null;
  bundle_quantity: number | null;
  bundle_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "active" | "scheduled";
  badge_text: string | null;
  priority: number;
};

export type ProductPage = {
  product: StoreProduct;
  offers: ProductOffer[];
  breadcrumb: Array<{ name: string; slug: string }>;
  seo: Seo;
  related: ProductCard[];
  low_stock_threshold: number | null;
  rating: { average: number; count: number; stars: Record<string, number> };
};

export type ProductList = { data: ProductCard[]; meta: { current_page: number; last_page: number; per_page: number; total: number } };

export type StaticPage = { title: string; slug: string; body: string | null; seo: Seo };

export type ShippingOption = { id: number; name: string; logo: Record<string, string> | null; days_min: number | null; days_max: number | null; original: number; fee: number; offer: string | null };

export type CartQuote = {
  lines: Array<{
    product_id: number;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    offer: { id: number; name: string } | null;
    offer_discount: number;
    total: number;
    options: Array<{ option: string; value: string; price_delta: number }>;
    gift: { product_id: number; name: string } | null;
  }>;
  items_count: number;
  subtotal: number;
  offer_discount: number;
  code: string | null;
  code_discount: number;
  code_error: string | null;
  shipping: number | null;
  shipping_original: number | null;
  shipping_free: boolean;
  shipping_available: boolean;
  shipping_company: { id: number; name: string; days_min: number | null; days_max: number | null } | null;
  shipping_offer: { id: number; name: string } | null;
  shipping_by_code: boolean;
  shipping_options: ShippingOption[];
  total: number;
};

export type TrackStage = "received" | "confirmed" | "shipped" | "delivered" | "returned" | "cancelled";

export type TrackedOrder = {
  order_number: number;
  stage: TrackStage;
  created_at: string;
  items: Array<{ name: string; quantity: number; options: string[] }>;
  total: number;
  governorate: string | null;
  shipping_company: string | null;
  tracking_number: string | null;
  history: Array<{ stage: TrackStage; at: string }>;
};
