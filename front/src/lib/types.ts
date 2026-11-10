/** Shapes returned by the Laravel API (dates are ISO 8601 UTC strings). */

import type { Entitlements } from "@/lib/billing/types";

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "owner" | "super_admin";
  last_login_at: string | null;
};

export type Tenant = {
  id: number;
  name: string;
  status: "active" | "suspended";
  whatsapp_template?: string | null;
  created_at: string | null;
};

/** How public sites are reached (production: https, no port; local: http + 3000). */
export type PublicOrigin = { scheme: "http" | "https"; port: string };

export type Session = {
  user: User;
  tenant: Tenant | null;
  primary_host: string | null;
  /** The store's plan right now (null for the super admin). */
  plan: Entitlements | null;
  public_origin: PublicOrigin;
};

export type MediaUrls = { thumb: string; medium: string; large: string; icon32?: string; icon180?: string };

export type MediaItem = {
  id: number;
  name: string;
  alt: string | null;
  width: number;
  height: number;
  urls: MediaUrls;
  size: number;
  created_at: string | null;
};

export type MediaUsage = { type: string; id: number; name: string; label: string };

export type OptionDisplayType = "buttons" | "dropdown" | "swatch";

export type ProductOptionValue = { id: number; label: string; color_hex: string | null; price_delta: number; is_active: boolean };
export type ProductOption = { id: number; name: string; display_type: OptionDisplayType; is_required: boolean; values: ProductOptionValue[] };

export type Product = {
  /** Above the plan limit after a downgrade: kept, not served to visitors. */
  locked_by_plan?: boolean;
  id: number;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  discount_percent: number | null;
  sku: string | null;
  is_active: boolean;
  main_image?: MediaItem | null;
  media?: MediaItem[];
  media_ids?: number[];
  options_count?: number;
  options?: ProductOption[];
  /* Store fields. */
  slug?: string | null;
  short_description?: string | null;
  in_store?: boolean;
  is_featured?: boolean;
  stock_mode?: StockMode;
  stock?: number | null;
  low_stock_threshold?: number | null;
  seo?: { title?: string | null; description?: string | null; og_media_id?: number | null; noindex?: boolean | null } | null;
  category_ids?: number[];
  variants?: Array<{ id: number; value_ids: number[]; stock: number; sku: string | null }>;
  created_at: string | null;
  updated_at: string | null;
};

export type StockMode = "unlimited" | "product" | "variant";

export type PageRef = { id: number; title: string };

export type PromotionStatus = "inactive" | "scheduled" | "active" | "expired";
export type OfferType = "percentage" | "fixed" | "bundle" | "buy_get" | "gift";
export type DiscountType = "percentage" | "fixed";

export type Offer = {
  /** Above the plan limit after a downgrade: kept, not served to visitors. */
  locked_by_plan?: boolean;
  id: number;
  name: string;
  type: OfferType;
  value: number | null;
  bundle_quantity: number | null;
  bundle_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  status: PromotionStatus;
  badge_text: string | null;
  priority: number;
  /** percentage / fixed / gift: smallest quantity; buy_get: units paid. */
  min_quantity: number;
  /** buy_get: free units per group. */
  free_quantity: number | null;
  gift_product_id: number | null;
  gift_product?: { id: number; name: string; price: number } | null;
  products?: Array<{ id: number; name: string; price: number }>;
  product_ids?: number[];
  created_at: string | null;
  updated_at: string | null;
};

export type DiscountCode = {
  /** Above the plan limit after a downgrade: kept, not served to visitors. */
  locked_by_plan?: boolean;
  id: number;
  code: string;
  type: DiscountType;
  value: number;
  max_discount: number | null;
  min_order_total: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_limit_per_phone: number | null;
  used_count: number;
  remaining: number | null;
  stackable_with_offers: boolean;
  is_active: boolean;
  status: PromotionStatus;
  products?: Array<{ id: number; name: string }>;
  product_ids?: number[];
  created_at: string | null;
  updated_at: string | null;
};

export type Redemption = { id: number; order_id: number; order_number?: number | null; phone: string; amount: number; released_at: string | null; created_at: string | null };

export type Quote = {
  currency: "EGP";
  unit_price: number;
  quantity: number;
  base_subtotal: number;
  offer: { id: number; name: string; type: OfferType; discount: number } | null;
  /** Free product of a gift offer (value = its regular price). */
  gift?: { product_id: number; name: string; value: number } | null;
  /** Why the offer the customer chose does not apply to this quantity. */
  offer_error?: string | null;
  subtotal_after_offer: number;
  code: { code: string; discount: number } | null;
  code_error: string | null;
  /** Products after discounts (before delivery). */
  items_total?: number;
  /** Delivery fee; null = shipping off or no governorate chosen yet. Included in total. */
  shipping?: number | null;
  shipping_free?: boolean;
  shipping_available?: boolean;
  total: number;
  at?: string;
};

export type ColorKey = "primary" | "primary_foreground" | "secondary" | "accent" | "background" | "foreground" | "muted" | "border";
export type IdentityColors = Record<ColorKey, string>;
export type ButtonRadius = "none" | "sm" | "md" | "lg" | "full";

export type Identity = {
  id: number;
  name: string;
  is_default: boolean;
  brand_name: string;
  logo_media_id: number | null;
  favicon_media_id: number | null;
  og_image_media_id: number | null;
  logo: MediaItem | null;
  favicon: MediaItem | null;
  og_image: MediaItem | null;
  colors: IdentityColors;
  font_heading: string;
  font_body: string;
  button_radius: ButtonRadius;
  seo_title: string | null;
  seo_title_suffix: string | null;
  seo_description: string | null;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  socials: Record<"facebook" | "instagram" | "tiktok" | "youtube" | "x" | "snapchat", string | null>;
  tracking: import("@/lib/tracking/ids").Tracking;
  created_at: string | null;
  updated_at: string | null;
};
