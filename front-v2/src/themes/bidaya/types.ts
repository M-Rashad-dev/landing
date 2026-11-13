/** «بداية» page content and the data it shows (back end: App\Themes\BidayaDesign, PublicSite::payload). */
import type { ProductOffer, ShippingConfig, StoreProduct } from "@/lib/store/types";
import type { Colors, FontKey, FontSize, IconKey, MediaUrls, Social } from "@/themes/asas/types";

export type { Colors, FontKey, FontSize, IconKey, Social };

export type ButtonShape = "rounded" | "pill" | "square";

export type Settings = {
  colors: Colors;
  font: FontKey;
  font_size: FontSize;
  button: ButtonShape;
  logo_media_id: number | null;
  header: { show: boolean; announcement: string | null };
  footer: { text: string | null; phone: string | null; whatsapp: string | null; social: Record<Social, string | null> };
  general: { sticky_order_button: boolean; whatsapp_button: boolean };
};

export type FormFieldKey = "name" | "phone" | "phone2" | "email" | "governorate" | "city" | "address" | "notes";
/** The fields the merchant switches (name and phone are always asked). */
export const SWITCHABLE: FormFieldKey[] = ["phone2", "email", "governorate", "city", "address", "notes"];

export type HeroProps = { title: string; subtitle: string | null; image_media_id: number | null; show_price: boolean; button_label: string; badge: string | null };
export type FeaturesProps = { title: string | null; items: Array<{ icon: IconKey; title: string; text: string | null }> };
export type GalleryProps = { title: string | null; image_media_ids: number[] };
export type TestimonialsProps = { title: string | null; source: "auto" | "manual"; items: Array<{ name: string; rating: number; text: string }> };
export type FaqProps = { title: string | null; items: Array<{ question: string; answer: string }> };
export type OrderFormProps = {
  title: string;
  subtitle: string | null;
  button_label: string;
  fields: Record<FormFieldKey, { enabled: boolean; required: boolean }>;
  offer_picker: boolean;
  show_quantity: boolean;
};

export type Section =
  | { id: string; type: "hero"; visible: boolean; props: HeroProps }
  | { id: string; type: "features"; visible: boolean; props: FeaturesProps }
  | { id: string; type: "gallery"; visible: boolean; props: GalleryProps }
  | { id: string; type: "testimonials"; visible: boolean; props: TestimonialsProps }
  | { id: string; type: "faq"; visible: boolean; props: FaqProps }
  | { id: string; type: "order_form"; visible: boolean; props: OrderFormProps };
export type SectionType = Section["type"];

export type Content = { version: number; settings: Settings; sections: Section[] };

export type PageImage = { id: number; alt: string | null; width: number | null; height: number | null; urls: MediaUrls };

/** Everything the page shows besides its own content. */
export type LandingData = {
  page: { id: number; slug: string; title: string };
  store_name: string;
  product: StoreProduct | null;
  offers: ProductOffer[];
  media: Record<string, PageImage>;
  reviews: Array<{ name: string; rating: number; text: string }>;
  shipping: ShippingConfig;
};

/** The order a landing page sends (POST /api/public/landing/orders answers this). */
export type PlacedOrder = { order_number: number; total: number };

/** Live price of the page product (back end: App\Pricing\Quote::toArray). */
export type LandingQuote = {
  unit_price: number;
  quantity: number;
  base_subtotal: number;
  offer: { id: number; name: string; type: string; discount: number } | null;
  gift?: { product_id: number; name: string; value: number } | null;
  offer_error?: string | null;
  subtotal_after_offer: number;
  code: { code: string; discount: number } | null;
  code_error: string | null;
  items_total?: number;
  shipping?: number | null;
  shipping_free?: boolean;
  shipping_available?: boolean;
  shipping_options?: Array<{ id: number; name: string; days_min: number | null; days_max: number | null; fee: number; original: number; offer: string | null }>;
  shipping_company?: { id: number; name: string } | null;
  total: number;
};

export const BUTTON_RADIUS: Record<ButtonShape, string> = { rounded: "0.7rem", pill: "999px", square: "0.15rem" };
