/** Shapes returned by the Laravel API (dates are ISO 8601 UTC strings). */

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
  created_at: string | null;
};

export type Session = {
  user: User;
  tenant: Tenant | null;
  primary_host: string | null;
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
  created_at: string | null;
  updated_at: string | null;
};

export type PageRef = { id: number; title: string };

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
