import type { PageContext, PublicIdentity, PublicImage, PublicOffer, PublicProduct } from "@/themes/types";

/**
 * Demo data for the /dev/themes review page and component tests only
 * (never used by live pages). Images are generated SVG gradients.
 */
function svgImage(id: number, hue: number, label: string, width = 1200, height = 1200): PublicImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,72%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,45%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" font-family="sans-serif" font-size="${Math.round(width / 10)}" fill="rgba(255,255,255,.85)" text-anchor="middle">${label}</text></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { id, alt: label, width, height, urls: { thumb: url, medium: url, large: url } };
}

export const DEMO_IMAGES: PublicImage[] = [svgImage(901, 260, "1"), svgImage(902, 20, "2"), svgImage(903, 160, "3"), svgImage(904, 320, "4", 1200, 800)];

export const DEMO_IDENTITIES: Record<string, PublicIdentity> = {
  violet: {
    brand_name: "متجر ملاك",
    colors: { primary: "#7C3AED", primary_foreground: "#FFFFFF", secondary: "#F5F3FF", accent: "#F59E0B", background: "#FFFFFF", foreground: "#1F2937", muted: "#6B7280", border: "#E5E7EB" },
    font_heading: "tajawal",
    font_body: "cairo",
    button_radius: "full",
    logo: null,
    favicon: null,
    og_image: null,
    seo_title: null,
    seo_title_suffix: null,
    seo_description: null,
    contact: { phone: "+201012345678", whatsapp: "+201012345678", email: "shop@example.com", address: "القاهرة، مصر" },
    socials: { facebook: "https://facebook.com/shop", instagram: "https://instagram.com/shop", tiktok: "https://tiktok.com/@shop", youtube: null, x: null, snapchat: null },
  },
  dark: {
    brand_name: "CELIA",
    colors: { primary: "#F43F5E", primary_foreground: "#FFFFFF", secondary: "#1F2937", accent: "#FACC15", background: "#0B0B0F", foreground: "#F9FAFB", muted: "#9CA3AF", border: "#374151" },
    font_heading: "readex_pro",
    font_body: "ibm_plex_arabic",
    button_radius: "none",
    logo: null,
    favicon: null,
    og_image: null,
    seo_title: null,
    seo_title_suffix: null,
    seo_description: null,
    contact: { phone: "+201112345678", whatsapp: null, email: null, address: null },
    socials: { facebook: null, instagram: "https://instagram.com/celia", tiktok: null, youtube: "https://youtube.com/@celia", x: "https://x.com/celia", snapchat: null },
  },
  green: {
    brand_name: "بيت الأعشاب الطبيعية للعناية الكاملة",
    colors: { primary: "#15803D", primary_foreground: "#FFFFFF", secondary: "#ECFDF5", accent: "#FB923C", background: "#FFFDF7", foreground: "#14231A", muted: "#5B6B60", border: "#D9E4DC" },
    font_heading: "noto_kufi",
    font_body: "almarai",
    button_radius: "md",
    logo: null,
    favicon: null,
    og_image: null,
    seo_title: null,
    seo_title_suffix: null,
    seo_description: null,
    contact: { phone: null, whatsapp: "+201512345678", email: null, address: "الإسكندرية" },
    socials: { facebook: null, instagram: null, tiktok: null, youtube: null, x: null, snapchat: "https://snapchat.com/add/x" },
  },
};

export const DEMO_PRODUCT: PublicProduct = {
  id: 77,
  name: "تيشيرت قطن مصري فاخر بقصّة مريحة لكل الأوقات",
  description: "**قطن مصري 100%** بخامة ناعمة.\n\n- مقاسات من S إلى XXL\n- ألوان ثابتة لا تبهت\n- مناسب للصيف والشتاء",
  price: 350,
  compare_at_price: 450,
  available: true,
  images: DEMO_IMAGES,
  options: [
    { id: 1, name: "المقاس", display_type: "buttons", is_required: true, values: [{ id: 11, label: "S", color_hex: null, price_delta: 0 }, { id: 12, label: "M", color_hex: null, price_delta: 0 }, { id: 13, label: "XL", color_hex: null, price_delta: 25 }] },
    { id: 2, name: "اللون", display_type: "swatch", is_required: true, values: [{ id: 21, label: "أسود", color_hex: "#111111", price_delta: 0 }, { id: 22, label: "أبيض", color_hex: "#F9FAFB", price_delta: 0 }] },
    { id: 3, name: "التغليف", display_type: "dropdown", is_required: false, values: [{ id: 31, label: "هدية", color_hex: null, price_delta: 15 }] },
  ],
};

export function demoOffers(now = Date.now()): PublicOffer[] {
  const iso = (ms: number) => new Date(now + ms).toISOString();
  return [
    { id: 501, name: "اشترِ 2 بـ 600", type: "bundle", value: null, bundle_quantity: 2, bundle_price: 600, starts_at: null, ends_at: iso(2 * 86400_000), status: "active", badge_text: "الأكثر طلبًا", priority: 1 },
    { id: 502, name: "اشترِ 3 بـ 850", type: "bundle", value: null, bundle_quantity: 3, bundle_price: 850, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 0 },
    { id: 503, name: "خصم 10%", type: "percentage", value: 10, bundle_quantity: null, bundle_price: null, starts_at: null, ends_at: iso(6 * 3600_000), status: "active", badge_text: "وفّر 10%", priority: 0 },
    { id: 504, name: "عرض قادم", type: "fixed", value: 50, bundle_quantity: null, bundle_price: null, starts_at: iso(86400_000), ends_at: null, status: "scheduled", badge_text: null, priority: 0 },
  ];
}

export function demoContext(identity: PublicIdentity = DEMO_IDENTITIES.violet, overrides: Partial<PageContext> = {}): PageContext {
  return {
    host: "demo.localhost",
    isPreview: true,
    identity,
    product: DEMO_PRODUCT,
    offers: demoOffers(),
    page: { id: 1, slug: "demo", title: "Demo" },
    media: Object.fromEntries(DEMO_IMAGES.map((image) => [image.id, image])),
    ...overrides,
  };
}

/** Props that use the demo images (testimonial proofs, custom gallery, hero image). */
export const DEMO_PROP_OVERRIDES: Record<string, Record<string, unknown>> = {
  hero: { image_media_id: 901 },
  gallery: { source: "custom", image_media_ids: [901, 902, 903, 904] },
  testimonials: {
    items: [
      { name: "سارة", subtitle: "القاهرة", text: "منتج رائع جدًا والتوصيل سريع.", rating: 5, avatar_media_id: 902, proof_media_id: 904 },
      { name: "أحمد", subtitle: "الجيزة", text: "جودة ممتازة.", rating: 4, avatar_media_id: null, proof_media_id: null },
      { name: "منى", subtitle: "طنطا", text: "نص طويل جدًا ".repeat(12), rating: 5, avatar_media_id: null, proof_media_id: 903 },
    ],
  },
  features: { items: [{ icon: "truck", title: "شحن سريع", description: "خلال يومين.", image_media_id: 903 }, { icon: "wallet", title: "دفع عند الاستلام", description: "", image_media_id: null }, { icon: "refresh", title: "ك", description: "استرجاع خلال 14 يوم.", image_media_id: null }] },
};
