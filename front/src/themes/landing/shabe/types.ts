/** «شابع» page content (back end: App\Themes\ShabeDesign). Its settings extend «بداية»'s. */
import type { OrderFormProps as BidayaFormProps, Settings as BidayaSettings } from "@/themes/landing/bidaya/types";

export const SHABE_KEY = "shabe_landing";

export type ShabeIcon =
  | "truck" | "cash" | "return" | "shield" | "support" | "gift" | "star" | "clock" | "tag" | "heart" | "package" | "phone"
  | "flame" | "chef" | "leaf" | "utensils" | "meat" | "timer" | "thermo" | "bike" | "soup" | "sparkle";

export type ShabeSettings = Omit<BidayaSettings, "colors" | "header"> & {
  colors: BidayaSettings["colors"] & { dark: string };
  display_font: boolean;
  header: BidayaSettings["header"] & { countdown_ends_at: string | null; phone: string | null; button_label: string | null };
};

type IconItem = { icon: ShabeIcon; title: string; text: string | null };

export type HeroProps = {
  kicker: string | null;
  title: string;
  highlight: string | null;
  subtitle: string | null;
  image_media_id: number | null;
  stickers: string[];
  badge: string | null;
  show_price: boolean;
  show_rating: boolean;
  button_label: string;
  second_label: string | null;
  trust: Array<{ icon: ShabeIcon; text: string }>;
};
export type MarqueeProps = { items: string[] };
export type MenuProps = { kicker: string | null; title: string | null; subtitle: string | null; items: Array<{ image_media_id: number | null; title: string; text: string | null; tag: string | null }>; extras: string[] };
export type WhyProps = { kicker: string | null; title: string | null; subtitle: string | null; image_media_id: number | null; quote: string | null; items: IconItem[] };
export type StepsProps = { kicker: string | null; title: string | null; items: IconItem[] };
export type BundleCard = { offer_id: number | null; image_media_id: number | null; title: string; subtitle: string | null; points: string[]; ribbon: string | null };
export type BundlesProps = { kicker: string | null; title: string | null; subtitle: string | null; cards: BundleCard[] };
export type GalleryProps = { title: string | null; image_media_ids: number[] };
export type VideoProps = { title: string | null; subtitle: string | null; url: string; cover_media_id: number | null; caption: string | null };
export type CompareProps = { title: string | null; us: string; them: string; rows: Array<{ label: string; us: string; them: string }> };
export type TestimonialsProps = {
  kicker: string | null;
  title: string | null;
  source: "auto" | "manual";
  items: Array<{ name: string; place: string | null; rating: number; text: string; image_media_id: number | null }>;
  show_score: boolean;
};
export type UrgencyProps = { title: string; text: string | null; ends_at: string | null; show_stock: boolean };
export type OrderFormProps = BidayaFormProps & { kicker: string | null; points: string[]; image_media_id: number | null };
export type GuaranteeProps = { icon: ShabeIcon; title: string; text: string | null };
export type FaqProps = { title: string | null; items: Array<{ question: string; answer: string }> };

type S<T extends string, P> = { id: string; type: T; visible: boolean; props: P };
export type ShabeSection =
  | S<"hero", HeroProps>
  | S<"marquee", MarqueeProps>
  | S<"menu", MenuProps>
  | S<"why", WhyProps>
  | S<"steps", StepsProps>
  | S<"bundles", BundlesProps>
  | S<"gallery", GalleryProps>
  | S<"video", VideoProps>
  | S<"compare", CompareProps>
  | S<"testimonials", TestimonialsProps>
  | S<"urgency", UrgencyProps>
  | S<"order_form", OrderFormProps>
  | S<"guarantee", GuaranteeProps>
  | S<"faq", FaqProps>;
export type ShabeSectionType = ShabeSection["type"];

export type ShabeContent = { version: number; settings: ShabeSettings; sections: ShabeSection[] };

export const SHABE_MAX_SECTIONS = 20;

/** Asks the order form to pick an offer (0 = one piece) — sent by the pack cards. */
export const CHOOSE_OFFER_EVENT = "shabe:choose-offer";
