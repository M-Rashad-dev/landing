/** «صوفي · صفحة هبوط» page content (back end: App\Themes\Landing\SufiLandingDesign). Its settings extend «بداية»'s. */
import type { OrderFormProps as BidayaFormProps, Settings as BidayaSettings } from "@/themes/landing/bidaya/types";
import type { AiSectionProps } from "@/themes/shared/ai-section/types";
import type { Colors } from "@/themes/shared/design";

export const SUFI_LANDING_KEY = "sufi_landing";

export const SUFI_LANDING_MAX_SECTIONS = 20;

export type SufiIcon =
  | "truck" | "cash" | "return" | "shield" | "support" | "gift" | "star" | "clock" | "tag" | "heart" | "package" | "phone"
  | "gem" | "crown" | "award" | "feather" | "droplet" | "sparkle" | "ruler" | "layers" | "leaf" | "palette" | "watch" | "badge";

export type Scheme = "light" | "dark";
export type Appearance = { default: "light" | "dark" | "system"; toggle: boolean };

export type SufiLandingSettings = Omit<BidayaSettings, "header" | "general"> & {
  colors_dark: Colors;
  appearance: Appearance;
  display_font: boolean;
  logo_dark_media_id: number | null;
  header: BidayaSettings["header"] & { button_label: string | null };
  general: BidayaSettings["general"] & { animations: boolean };
};

type IconItem = { icon: SufiIcon; title: string; text: string | null };
type Head = { kicker: string | null; title: string | null };

export type HeroLayout = "split" | "cover";
export type HeroProps = {
  layout: HeroLayout;
  kicker: string | null;
  title: string;
  highlight: string | null;
  subtitle: string | null;
  image_media_id: number | null;
  show_price: boolean;
  show_rating: boolean;
  button_label: string;
  second_label: string | null;
  badges: string[];
};
export type MarqueeProps = { items: string[] };
export type FeaturesProps = Head & { subtitle: string | null; items: IconItem[] };
export type DetailRow = { image_media_id: number | null; title: string; text: string | null; points: string[] };
export type DetailsProps = Head & { rows: DetailRow[] };
export type SpecsProps = Head & { image_media_id: number | null; rows: Array<{ label: string; value: string }>; note: string | null };
export type GalleryProps = Head & { image_media_ids: number[] };
export type VideoProps = { title: string | null; subtitle: string | null; url: string; cover_media_id: number | null };
export type BundleCard = { offer_id: number | null; image_media_id: number | null; title: string; subtitle: string | null; points: string[]; ribbon: string | null };
export type BundlesProps = Head & { subtitle: string | null; cards: BundleCard[] };
export type StatsProps = Head & { items: Array<{ value: string; label: string }> };
export type TestimonialsProps = Head & {
  source: "auto" | "manual";
  items: Array<{ name: string; place: string | null; rating: number; text: string; image_media_id: number | null }>;
  show_score: boolean;
};
export type CountdownProps = { kicker: string | null; title: string; text: string | null; ends_at: string | null; show_stock: boolean };
export type OrderFormProps = BidayaFormProps & { kicker: string | null; points: string[]; image_media_id: number | null };
export type PromisesProps = { items: IconItem[] };
export type FaqProps = Head & { items: Array<{ question: string; answer: string }> };

type S<T extends string, P> = { id: string; type: T; visible: boolean; props: P };
export type SufiLandingSection =
  | S<"hero", HeroProps>
  | S<"marquee", MarqueeProps>
  | S<"features", FeaturesProps>
  | S<"details", DetailsProps>
  | S<"specs", SpecsProps>
  | S<"gallery", GalleryProps>
  | S<"video", VideoProps>
  | S<"bundles", BundlesProps>
  | S<"stats", StatsProps>
  | S<"testimonials", TestimonialsProps>
  | S<"countdown", CountdownProps>
  | S<"order_form", OrderFormProps>
  | S<"promises", PromisesProps>
  | S<"faq", FaqProps>
  | S<"ai", AiSectionProps>;
export type SufiLandingSectionType = SufiLandingSection["type"];

export type SufiLandingContent = { version: number; settings: SufiLandingSettings; sections: SufiLandingSection[] };
