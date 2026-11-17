/**
 * The «شابع · متجر» showcase store: what a merchant sees on the theme's «معاينة» before buying it.
 * A fixed sample (pictures in public/themes/store/shabe/demo, free Unsplash photos), shown only on
 * the theme's demo page and never saved to any store.
 */
import type { DesignData, ProductCard } from "@/themes/store/shared/types";
import { CARD_DEFAULTS, CART_DEFAULTS, LISTING_DEFAULTS, PAGE_DEFAULTS, type ShabeStoreDesign, type ShabeStoreSection } from "./types";

const IMAGES = ["grill-box", "kofta", "kebab", "shish", "chicken", "ribs", "kabsa", "platters"] as const;
type Pic = (typeof IMAGES)[number];

const src = (name: Pic) => `/themes/store/shabe/demo/${name}.jpg`;
const id = (name: Pic) => IMAGES.indexOf(name) + 1;
const urls = (name: Pic) => ({ thumb: src(name), medium: src(name), large: src(name) });
const image = (name: Pic) => ({ id: id(name), alt: null, width: null, height: null, urls: urls(name) });

const all = { type: "all_products" as const, target_id: null, url: null };
const offers = { type: "offers" as const, target_id: null, url: null };

function dish(n: number, name: string, about: string, price: number, compare: number | null, pic: Pic, rating: number | null = null): ProductCard {
  return {
    id: n,
    slug: `demo-${n}`,
    name,
    short_description: about,
    price,
    compare_at_price: compare,
    discount_percent: compare ? Math.round(((compare - price) / compare) * 100) : null,
    image: image(pic),
    available: true,
    needs_options: false,
    rating: rating ? { average: rating, count: 30 + n * 9 } : null,
  };
}

const DISHES: ProductCard[] = [
  dish(1, "بوكس مشويات العيلة", "كفتة وكباب وشيش وفراخ، يكفي ٤ أفراد", 899, 1150, "grill-box", 4.9),
  dish(2, "كفتة مشوية ½ كيلو", "لحمة بلدي بالبصل والبقدونس", 220, null, "kofta", 4.8),
  dish(3, "كباب ضاني ½ كيلو", "متبّل ٢٤ ساعة، مع بطاطس", 340, 380, "kebab", 4.7),
  dish(4, "شيش طاووق", "٨ أسياخ بالزبادي والليمون", 180, null, "shish"),
  dish(5, "فراخ مشوية على الفحم", "فرخة كاملة متبّلة", 260, null, "chicken", 4.6),
  dish(6, "ريش ضاني", "ريش مشوية مع سلطة", 420, 470, "ribs"),
  dish(7, "كبسة فراخ", "أرز بسمتي وفراخ وصوص", 210, null, "kabsa"),
  dish(8, "طبق المشكّل", "تشكيلة لفردين", 390, null, "platters"),
];

const s = (id: string, section: Omit<ShabeStoreSection, "id" | "visible">): ShabeStoreSection => ({ id, visible: true, ...section }) as ShabeStoreSection;

export const SHABE_DEMO_DESIGN: ShabeStoreDesign = {
  settings: {
    colors: { primary: "#e4572e", secondary: "#f2b33d", background: "#fffaf2", text: "#1b120c", dark: "#17110d" },
    font: "cairo",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    display_font: true,
    button: "pill",
    header: { sticky: true, search: true, announcement: "التوصيل ببلاش لأول طلب من المتجر", layout: "start", countdown_ends_at: null, hotline: "19999", button_label: "اطلب دلوقتي", button_link: all, categories_menu: true },
    footer: {
      about: "مطبخ بيتي بيشوي على الفحم ساعة الطلب، ويوصلك سخن لحد باب البيت.",
      show_pages: true,
      phone: "01000000000",
      whatsapp: "01000000000",
      email: null,
      address: "القاهرة",
      social: { facebook: "https://facebook.com", instagram: "https://instagram.com", tiktok: null, x: null, youtube: null, snapchat: null },
      dark: true,
      payments: true,
    },
    general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: true },
    product_card: CARD_DEFAULTS,
    product_page: PAGE_DEFAULTS,
    listing: LISTING_DEFAULTS,
    cart: CART_DEFAULTS,
  },
  sections: [
    s("demo-hero", {
      type: "food_hero",
      props: {
        kicker: "طازة كل يوم · بيوصلك سخن",
        title: "أكل يشبّعك ويفتح نفسك",
        highlight: "يشبّعك",
        subtitle: "اختار من المنيو اللي نفسك فيه، بيتعمل ساعة الطلب ويوصلك سخن، والدفع عند الاستلام.",
        media_id: id("grill-box"),
        stickers: ["طازة كل يوم", "بيوصلك سخن"],
        badge: "عرض النهارده",
        primary_label: "اطلب دلوقتي",
        primary_link: all,
        second_label: "شوف العروض",
        second_link: offers,
        trust: [
          { icon: "bike", text: "توصيل في نفس اليوم" },
          { icon: "cash", text: "ادفع لما يوصلك" },
          { icon: "thermo", text: "بيوصل سخن" },
        ],
      },
    }),
    s("demo-marquee", { type: "marquee", props: { items: ["مكونات طازة", "متعمل ساعة الطلب", "الدفع عند الاستلام", "توصيل سريع"], speed: "normal" } }),
    s("demo-categories", { type: "categories", props: { title: "المنيو", description: null, category_ids: [], shape: "circle", layout: "slider", columns_desktop: 6, columns_mobile: 3 } }),
    s("demo-tabs", { type: "product_tabs", props: { title: "اختار أكلتك", description: null, limit: 8, tabs: [{ label: "الأكثر طلبًا", source: "latest", category_id: null, product_ids: [] }, { label: "العروض", source: "offers", category_id: null, product_ids: [] }] } }),
    s("demo-bundles", {
      type: "bundles",
      props: {
        kicker: "للعزومات",
        title: "اختار اللي على قد لمّتك",
        subtitle: null,
        cards: [
          { offer_id: 1, media_id: id("grill-box"), title: "بوكس العيلة", subtitle: "لـ ٤–٥ أفراد", points: ["٢ كيلو مشويات مشكّلة", "أرز + ٦ أرغفة + صوصات", "سلطة + مخلل"], ribbon: null, button_label: null },
          { offer_id: 2, media_id: id("platters"), title: "بوكس العزومة", subtitle: "لـ ٨–١٠ أفراد", points: ["٢ بوكس مشويات", "أرز وعيش وصوصات", "توصيل ببلاش"], ribbon: "الأكتر طلبًا", button_label: null },
        ],
      },
    }),
    s("demo-why", {
      type: "why",
      props: {
        kicker: "ليه إحنا؟",
        title: "الطعم اللي بتحبه، من غير مشوار",
        subtitle: null,
        media_id: id("kabsa"),
        quote: "«بنشوي كل بوكس ساعة ما بتطلبه» — الشيف حسن",
        items: [
          { icon: "leaf", title: "مكونات طازة", text: "بنشتري كل يوم، مفيش مجمد." },
          { icon: "chef", title: "وصفة البيت", text: "نفس الطعم كل مرة." },
          { icon: "thermo", title: "بيوصل سخن", text: "علب حافظة للحرارة لحد باب البيت." },
          { icon: "shield", title: "مطبخ نضيف", text: "نضافة ومراجعة كل يوم." },
        ],
      },
    }),
    s("demo-steps", {
      type: "steps",
      props: {
        kicker: null,
        title: "٣ خطوات وتبقى شابع",
        items: [
          { icon: "utensils", title: "اختار من المنيو", text: "ضيف اللي نفسك فيه للسلة." },
          { icon: "phone", title: "نكلمك نأكد", text: "نتصل نأكد الطلب ومعاد التوصيل." },
          { icon: "bike", title: "يوصلك سخن", text: "تستلم وتدفع للمندوب." },
        ],
      },
    }),
    s("demo-reviews", { type: "testimonials", props: { title: "كلام اللي جرّبوا", source: "auto", items: [] } }),
    s("demo-hours", {
      type: "hours",
      props: {
        title: "مواعيد المطبخ",
        subtitle: "بنستقبل الطلبات طول الأسبوع، والجمعة من بعد الصلاة.",
        days: [
          { open: true, from: "12:00", to: "01:00" },
          { open: true, from: "12:00", to: "01:00" },
          { open: true, from: "12:00", to: "01:00" },
          { open: true, from: "12:00", to: "01:00" },
          { open: true, from: "12:00", to: "02:00" },
          { open: true, from: "12:00", to: "02:00" },
          { open: true, from: "14:00", to: "02:00" },
        ],
        open_message: "المطبخ شغال دلوقتي وجاهز يستقبل طلبك.",
        closed_message: "المطبخ مقفول دلوقتي، وأي طلب هيوصلك أول ما نفتح.",
      },
    }),
    s("demo-faq", {
      type: "faq",
      props: {
        title: "عندك سؤال؟",
        text: null,
        whatsapp_button: true,
        items: [
          { question: "الطلب بيوصل في قد إيه؟", answer: "من ساعة لساعة ونص حسب منطقتك، وبنأكد معاك المعاد بمكالمة." },
          { question: "الدفع بيبقى إزاي؟", answer: "كاش عند استلام الطلب." },
          { question: "ينفع أطلب لعزومة كبيرة؟", answer: "أكيد، اختار بوكس العزومة أو كلّمنا واتساب ونظبطلك." },
        ],
      },
    }),
  ],
};

const offer = (n: number, name: string, quantity: number, price: number) => ({
  id: n,
  name,
  type: "bundle" as const,
  value: null,
  min_quantity: 1,
  free_quantity: null,
  required_quantity: quantity,
  gift: null,
  bundle_quantity: quantity,
  bundle_price: price,
  starts_at: null,
  ends_at: null,
  status: "active" as const,
  badge_text: null,
  priority: 1,
});

export const SHABE_DEMO_DATA: DesignData = {
  products: { "demo-tabs:0": DISHES, "demo-tabs:1": DISHES.filter((d) => d.compare_at_price) },
  view_all: {},
  links: { "demo-hero:primary": "/products", "demo-hero:second": "/offers", header_button: "/products" },
  media: Object.fromEntries(IMAGES.map((name) => [String(id(name)), urls(name)])),
  categories: [
    { id: 1, parent_id: null, name: "مشويات", slug: "demo-grill" },
    { id: 2, parent_id: null, name: "بوكسات", slug: "demo-boxes" },
    { id: 3, parent_id: null, name: "أطباق جانبية", slug: "demo-sides" },
    { id: 4, parent_id: null, name: "أرز وكبسة", slug: "demo-rice" },
  ],
  pages: [],
  reviews: [
    { name: "منى إبراهيم", rating: 5, text: "الكفتة طعمها زي كفتة الحاتي بالظبط، والبوكس وصل سخن والكمية كبيرة." },
    { name: "كريم سامي", rating: 5, text: "عزمت ٩ أفراد وكفّى وزيادة. الفراخ متبّلة حلو جدًا والتومية تحفة." },
    { name: "ياسمين علي", rating: 4, text: "الشيش طاووق طري والتوصيل في ساعة وربع. عمومًا ممتاز." },
  ],
  ...{
    category_tiles: {
      "demo-categories": [
        { id: 1, name: "مشويات", slug: "demo-grill", image: image("kebab"), products_count: 12 },
        { id: 2, name: "بوكسات", slug: "demo-boxes", image: image("grill-box"), products_count: 4 },
        { id: 3, name: "فراخ", slug: "demo-chicken", image: image("chicken"), products_count: 6 },
        { id: 4, name: "أرز وكبسة", slug: "demo-rice", image: image("kabsa"), products_count: 5 },
        { id: 5, name: "ريش", slug: "demo-ribs", image: image("ribs"), products_count: 3 },
        { id: 6, name: "أطباق مشكّلة", slug: "demo-platters", image: image("platters"), products_count: 7 },
      ],
    },
    bundles: {
      "demo-bundles": [
        { offer: offer(1, "بوكس العيلة", 1, 899), product: { ...DISHES[0], price: 899 }, href: "/products/demo-1" },
        { offer: offer(2, "بوكسين للعزومة", 2, 1650), product: DISHES[0], href: "/products/demo-1" },
      ],
    },
  },
};
