/** «رواق · صفحة هبوط» page content (back end: App\Themes\Landing\RawaqLandingDesign). Its settings extend «بداية»'s. */
import type { OrderFormProps as BidayaFormProps, Settings as BidayaSettings } from "@/themes/landing/bidaya/types";
import type { AiSectionProps } from "@/themes/shared/ai-section/types";

export const RAWAQ_LANDING_KEY = "rawaq_landing";

export const RAWAQ_LANDING_MAX_SECTIONS = 20;

export type RawaqIcon =
  | "truck" | "cash" | "return" | "shield" | "support" | "gift" | "star" | "clock" | "tag" | "heart" | "package" | "phone"
  | "droplet" | "sparkle" | "leaf" | "sun" | "moon" | "flask" | "smile" | "feather" | "award" | "gem" | "hand" | "flower";

export type RawaqLandingSettings = Omit<BidayaSettings, "colors" | "header" | "general"> & {
  colors: BidayaSettings["colors"] & { dark: string };
  display_font: boolean;
  header: BidayaSettings["header"] & { button_label: string | null };
  general: BidayaSettings["general"] & { animations: boolean };
};

type IconItem = { icon: RawaqIcon; title: string; text: string | null };
type Head = { kicker: string | null; title: string | null };

export type HeroProps = {
  kicker: string | null;
  title: string;
  highlight: string | null;
  subtitle: string | null;
  image_media_id: number | null;
  /** A round tilted badge on the picture («خصم 30%»). */
  badge: string | null;
  show_price: boolean;
  show_rating: boolean;
  button_label: string;
  second_label: string | null;
  chips: string[];
};
export type TrustProps = { items: IconItem[] };
export type Benefit = IconItem & { color: string | null };
export type BenefitsProps = Head & { items: Benefit[] };
export type BeforeAfterProps = Head & {
  text: string | null;
  /** Required to save (null only in a section just added in the Builder). */
  before_media_id: number | null;
  after_media_id: number | null;
  before_label: string;
  after_label: string;
  facts: Array<{ value: string; label: string }>;
};
export type Ingredient = { symbol: string; name: string; text: string | null; color: string | null };
export type IngredientsProps = Head & { subtitle: string | null; items: Ingredient[] };
export type HowToStep = { title: string; text: string | null; time: string | null };
export type HowToProps = Head & { image_media_id: number | null; steps: HowToStep[]; note: string | null };
export type SuitsProps = { title: string; items: string[]; note: string | null };
export type BundleCard = { offer_id: number | null; image_media_id: number | null; title: string; subtitle: string | null; points: string[]; ribbon: string | null };
export type BundlesProps = Head & { subtitle: string | null; cards: BundleCard[] };
export type StatsProps = Head & { items: Array<{ value: string; label: string }> };
export type GalleryProps = Head & { image_media_ids: number[] };
export type VideoProps = { title: string | null; subtitle: string | null; url: string; cover_media_id: number | null };
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
export type RawaqLandingSection =
  | S<"hero", HeroProps>
  | S<"trust", TrustProps>
  | S<"benefits", BenefitsProps>
  | S<"before_after", BeforeAfterProps>
  | S<"ingredients", IngredientsProps>
  | S<"how_to", HowToProps>
  | S<"suits", SuitsProps>
  | S<"bundles", BundlesProps>
  | S<"stats", StatsProps>
  | S<"gallery", GalleryProps>
  | S<"video", VideoProps>
  | S<"testimonials", TestimonialsProps>
  | S<"countdown", CountdownProps>
  | S<"order_form", OrderFormProps>
  | S<"promises", PromisesProps>
  | S<"faq", FaqProps>
  | S<"ai", AiSectionProps>;
export type RawaqLandingSectionType = RawaqLandingSection["type"];

export type RawaqLandingContent = { version: number; settings: RawaqLandingSettings; sections: RawaqLandingSection[] };
