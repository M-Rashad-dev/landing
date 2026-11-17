/** «صوفي» design and the data its sections show (back end: App\Store\Design\SufiDesign, StoreDesigner::data). */

import type { ProductOffer, StoreProduct } from "@/lib/store/types";
import type { Colors } from "@/themes/shared/design";
import type { DesignData, ProductCard, StoreSettings } from "@/themes/store/shared/types";
import type { BannerProps, FeaturesProps, LinkType, ProductsProps, TestimonialsProps } from "../asas/types";

export type Link = { type: LinkType; target_id: number | null; url: string | null };
export type Appearance = "light" | "dark" | "system";
export type Scheme = "light" | "dark";

/** Small / medium / large (header height, header logo, footer logo). */
export type Size = "sm" | "md" | "lg";

/** Settings added later are optional: designs saved before them read the defaults. */
export type SufiSettings = StoreSettings & {
  colors_dark: Colors;
  appearance: { default: Appearance; toggle: boolean };
  /** A logo for the dark scheme (a black logo would vanish on a dark header). */
  logo_dark_media_id?: number | null;
  header: StoreSettings["header"] & { layout: "center" | "start" | "end"; topbar: boolean; height?: Size; logo_size?: Size };
  footer: StoreSettings["footer"] & { logo?: boolean; logo_size?: Size };
  general: StoreSettings["general"] & {
    floating_call: boolean;
    /** Numbers of the floating buttons; empty = the footer's phone / WhatsApp. */
    call_phone?: string | null;
    whatsapp_number?: string | null;
    animations: boolean;
    offers_tab: { enabled: boolean; label: string | null; link: Link };
  };
};

export type HeroProps = BannerProps & { height: "full" | "large" | "medium"; merge_header: boolean; shade: number; kicker: string | null };
export type MarqueeProps = { items: string[]; speed: "slow" | "normal" | "fast" };
export type CategoriesProps = { title: string | null; description: string | null; category_ids: number[]; shape: "circle" | "square" | "card"; layout: "grid" | "slider"; columns_desktop: number; columns_mobile: number };
export type Tab = { label: string; source: "latest" | "offers" | "category" | "manual"; category_id: number | null; product_ids: number[] };
export type TabsProps = { title: string | null; description: string | null; limit: number; tabs: Tab[] };
export type BannersProps = { items: Array<{ media_id: number; kicker: string | null; title: string | null; button_label: string | null; link: Link }> };
export type CountdownProps = { media_id: number | null; kicker: string | null; title: string; text: string | null; button_label: string | null; link: Link; ends_at: string; on_end: "hide" | "ended" };
export type FeaturedProps = { product_id: number; kicker: string | null };
export type VideoProps = { url: string; title: string | null; text: string | null; cover_media_id: number | null };
export type BrandsProps = { title: string | null; items: Array<{ media_id: number; name: string | null; link: Link }> };
export type StoryProps = { kicker: string | null; title: string; text: string | null; media_id: number; media2_id: number | null; stats: Array<{ value: string; label: string }>; button_label: string | null; link: Link };
export type GalleryProps = { title: string | null; description: string | null; items: Array<{ media_id: number; label: string | null; link: Link }> };
export type FaqProps = { title: string | null; text: string | null; whatsapp_button: boolean; items: Array<{ question: string; answer: string }> };
export type Branch = { name: string; address: string; hours: string | null; phone: string | null; map_url: string };
export type LocationProps = { title: string | null; description: string | null; branches: Branch[] };

type S<T extends string, P> = { id: string; type: T; visible: boolean; props: P };
export type SufiSection =
  | S<"hero", HeroProps>
  | S<"marquee", MarqueeProps>
  | S<"categories", CategoriesProps>
  | S<"product_tabs", TabsProps>
  | S<"banners", BannersProps>
  | S<"countdown", CountdownProps>
  | S<"featured_product", FeaturedProps>
  | S<"products", ProductsProps>
  | S<"video", VideoProps>
  | S<"brands", BrandsProps>
  | S<"story", StoryProps>
  | S<"features", FeaturesProps>
  | S<"testimonials", TestimonialsProps>
  | S<"gallery", GalleryProps>
  | S<"faq", FaqProps>
  | S<"location", LocationProps>;
export type SufiSectionType = SufiSection["type"];

export type SufiDesign = { settings: SufiSettings; sections: SufiSection[] };

export type SufiCard = ProductCard & { image_2?: ProductCard["image"] };
export type CategoryTile = { id: number; name: string; slug: string; image: ProductCard["image"]; products_count: number };
export type Featured = { product: StoreProduct; offers: ProductOffer[]; rating: { average: number; count: number } } | null;

export type SufiData = DesignData & {
  products: Record<string, SufiCard[]>;
  category_tiles?: Record<string, CategoryTile[]>;
  featured?: Record<string, Featured>;
};

export const SUFI_KEY = "sufi_store";

/** A YouTube / Vimeo link → its embed address (null when it isn't one we can embed). */
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`;
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.match(/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** The YouTube poster of a link (used when the merchant set no cover image). */
export function youtubePoster(url: string): string | null {
  const embed = embedUrl(url);
  const id = embed?.match(/youtube-nocookie\.com\/embed\/([\w-]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * The map of a branch inside the page: the place from a full Google Maps link (coordinates or
 * place name), else the branch address. A short maps.app.goo.gl link can't be read, so the
 * address is used and the button still opens the merchant's own link.
 */
export function mapEmbed(branch: Branch): string {
  let q = branch.address;
  try {
    const u = new URL(branch.map_url);
    const at = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const place = u.pathname.match(/\/place\/([^/]+)/)?.[1];
    if (at) q = `${at[1]},${at[2]}`;
    else if (u.searchParams.get("q")) q = u.searchParams.get("q")!;
    else if (place) q = decodeURIComponent(place.replace(/\+/g, " "));
  } catch {
    // Not a URL we can read: the address it is.
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed&hl=ar`;
}
