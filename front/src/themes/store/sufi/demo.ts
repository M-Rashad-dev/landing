/**
 * The «صوفي» showcase store: what a merchant sees on the theme's «معاينة» before buying it.
 * A fixed sample (pictures in public/themes/store/sufi/demo, sample products and texts), shown only on
 * the theme's demo page and never saved to any store.
 */
import type { StoreProduct } from "@/lib/store/types";
import type { DesignData } from "@/themes/store/shared/types";
import type { SufiCard, SufiDesign, SufiSection } from "./types";

const IMAGES = ["hero-1", "rack", "headphones", "watch", "runner", "sneaker", "hoodie", "tshirt", "sunglasses", "camera", "men", "women", "phone", "shop", "knit", "store"] as const;
type Pic = (typeof IMAGES)[number];

const src = (name: Pic) => `/themes/store/sufi/demo/${name}.jpg`;
const id = (name: Pic) => IMAGES.indexOf(name) + 1;
const urls = (name: Pic) => ({ thumb: src(name), medium: src(name), large: src(name) });
const image = (name: Pic) => ({ id: id(name), alt: null, width: null, height: null, urls: urls(name) });

const none = { type: "none" as const, target_id: null, url: null };
const all = { type: "all_products" as const, target_id: null, url: null };
const offers = { type: "offers" as const, target_id: null, url: null };

function card(n: number, name: string, price: number, compare: number | null, pic: Pic, second: Pic | null = null, rating: number | null = null): SufiCard {
  return {
    id: n,
    slug: `demo-${n}`,
    name,
    short_description: null,
    price,
    compare_at_price: compare,
    discount_percent: compare ? Math.round(((compare - price) / compare) * 100) : null,
    image: image(pic),
    image_2: second ? image(second) : null,
    available: true,
    needs_options: false,
    rating: rating ? { average: rating, count: 40 + n * 7 } : null,
  };
}

const PRODUCTS: SufiCard[] = [
  card(1, "سماعة لاسلكية برو", 1850, 2400, "headphones", null, 4.8),
  card(2, "هودي قطن ثقيل", 890, null, "hoodie", "tshirt", 4.9),
  card(3, "ساعة كلاسيك جلد", 1290, 1600, "watch"),
  card(4, "كاميرا فورية", 3400, null, "camera", null, 4.7),
  card(5, "تيشيرت بيسك", 320, 420, "tshirt", "hoodie"),
  card(6, "نضارة شمس", 560, null, "sunglasses", null, 4.6),
  card(7, "كوتشي رانر إير", 2250, 3000, "runner", "sneaker", 4.9),
  card(8, "كوتشي إير ماكس", 2890, null, "sneaker", "runner"),
];

const FEATURED: StoreProduct = {
  id: 7,
  name: "كوتشي رانر إير",
  slug: "demo-7",
  description: null,
  short_description: "نعل خفيف ومريح لكل يوم، وخامة بتتنفس ومناسبة للجري والمشي الطويل. متاح بأكتر من لون.",
  price: 2250,
  compare_at_price: 3000,
  available: true,
  stock_mode: "unlimited",
  stock: null,
  variant_stock: null,
  images: [image("runner"), image("sneaker")],
  options: [
    { id: 1, name: "المقاس", display_type: "buttons", is_required: true, values: [40, 41, 42, 43, 44].map((s, i) => ({ id: 10 + i, label: String(s), color_hex: null, price_delta: 0 })) },
    { id: 2, name: "اللون", display_type: "swatch", is_required: true, values: [{ id: 20, label: "أحمر", color_hex: "#d23b2f", price_delta: 0 }, { id: 21, label: "أسود", color_hex: "#17181c", price_delta: 0 }, { id: 22, label: "أبيض", color_hex: "#f3f1ec", price_delta: 0 }] },
  ],
};

const s = <T extends SufiSection["type"]>(type: T, props: Extract<SufiSection, { type: T }>["props"]) => ({ id: `demo-${type}`, type, visible: true, props }) as SufiSection;


/** The showcase offer always ends in 2–3 days (a far date read as thousands of days on the countdown). */
const DEMO_OFFER_ENDS = new Date(Math.ceil(Date.now() / 86400000) * 86400000 + 2 * 86400000).toISOString();
export const SUFI_DEMO_DESIGN: SufiDesign = {
  settings: {
    colors: { primary: "#b9844f", secondary: "#17181c", background: "#faf8f4", text: "#17181c" },
    colors_dark: { primary: "#d49a60", secondary: "#f2f0ec", background: "#111215", text: "#f2f0ec" },
    appearance: { default: "light", toggle: true },
    font: "almarai",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    header: { sticky: true, search: true, announcement: "شحن مجاني للطلبات فوق 1,000 ج.م", layout: "center", topbar: true },
    footer: {
      about: "ملابس وإلكترونيات مختارة بعناية، بأسعار عادلة وشحن لكل مصر.",
      show_pages: true,
      phone: "0100 123 4567",
      whatsapp: "01001234567",
      email: "hello@sufi.store",
      address: "شارع عباس العقاد، مدينة نصر، القاهرة",
      social: { facebook: "https://facebook.com", instagram: "https://instagram.com", tiktok: "https://tiktok.com", x: null, youtube: null, snapchat: null },
    },
    general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24, floating_call: true, animations: true, offers_tab: { enabled: true, label: "عروض وخصومات", link: offers } },
  },
  sections: [
    s("hero", { slides: [{ media_id: id("hero-1"), title: "أناقة تليق بكل يوم في حياتك", text: "قطع مختارة بعناية من أحسن الخامات، وشحن لحد باب بيتك في كل المحافظات.", button_label: "تسوّق الآن", link: all }, { media_id: id("rack"), title: "تشكيلة الشتاء وصلت", text: null, button_label: "اكتشف", link: all }], autoplay: true, height: "full", merge_header: true, shade: 40, kicker: "مجموعة شتاء 2026" }),
    s("marquee", { items: ["شحن مجاني فوق 1,000 ج.م", "الدفع عند الاستلام", "استبدال خلال 14 يوم", "منتجات أصلية 100%"], speed: "normal" }),
    s("categories", { title: "تسوّق حسب القسم", description: null, category_ids: [], shape: "circle", layout: "grid", columns_desktop: 6, columns_mobile: 3 }),
    s("product_tabs", { title: "اختياراتنا ليك", description: "أكتر المنتجات اللي عملاءنا بيحبوها الأسبوع ده", limit: 8, tabs: [{ label: "الأكثر مبيعًا", source: "manual", category_id: null, product_ids: [] }, { label: "وصل حديثًا", source: "latest", category_id: null, product_ids: [] }, { label: "عروض", source: "offers", category_id: null, product_ids: [] }] }),
    s("banners", { items: [{ media_id: id("rack"), kicker: "NEW SEASON", title: "تشكيلة الشتاء وصلت", button_label: "اكتشف المجموعة", link: all }, { media_id: id("headphones"), kicker: "TECH DEALS", title: "سماعات لحد خصم 30%", button_label: "تسوّق الإلكترونيات", link: offers }] }),
    s("countdown", { media_id: id("watch"), kicker: "عرض لفترة محدودة", title: "الجمعة البيضاء خصم لحد 50%", text: "على كل الساعات والإكسسوارات، والعرض بيخلص مع العداد.", button_label: "الحق العرض", link: offers, ends_at: DEMO_OFFER_ENDS, on_end: "hide" }),
    s("featured_product", { product_id: 7, kicker: "الأكثر طلبًا هذا الشهر" }),
    s("products", { title: "وصل حديثًا", description: "آخر حاجة نزلت في المتجر", source: "latest", category_id: null, limit: 4, layout: "grid", columns: 4, show_view_all: true }),
    s("video", { url: "https://www.youtube.com/watch?v=ScMzIvxBSi4", title: "شوف إزاي بنجهّز طلبك", text: "من المخزن لحد باب بيتك في أقل من 48 ساعة", cover_media_id: id("store") }),
    s("story", { kicker: "قصتنا", title: "بدأنا من محل صغير ووصلنا لكل بيت", text: "من 2018 وإحنا بنختار كل قطعة بإيدينا، وبنجرّبها قبل ما توصلك. هدفنا إن كل طلب يوصلك بنفس الجودة اللي كنت هتلاقيها في المحل.", media_id: id("shop"), media2_id: id("knit"), stats: [{ value: "+40K", label: "عميل سعيد" }, { value: "27", label: "محافظة بنوصلها" }, { value: "4.9★", label: "متوسط التقييم" }], button_label: "اعرف أكتر عننا", link: none }),
    s("features", { title: null, items: [{ icon: "truck", title: "شحن سريع", text: "توصيل خلال 2-4 أيام لكل المحافظات" }, { icon: "cash", title: "الدفع عند الاستلام", text: "افحص طلبك وادفع وانت مطمن" }, { icon: "return", title: "استبدال سهل", text: "خلال 14 يوم من غير أسئلة كتير" }, { icon: "shield", title: "منتجات أصلية", text: "ضمان على كل منتج بنبيعه" }] }),
    s("testimonials", { title: "عملاءنا بيقولوا إيه", source: "manual", items: [{ name: "منة أحمد", rating: 5, text: "الجاكيت وصل في يومين والخامة أحلى من الصور بكتير. أكيد هطلب تاني." }, { name: "كريم سامي", rating: 5, text: "السماعات أصلية والتغليف ممتاز، وخدمة العملاء ردت عليا في دقايق." }, { name: "يوسف عادل", rating: 4, text: "المقاس كان كبير شوية واستبدلته بسهولة جدًا." }, { name: "سارة محمود", rating: 5, text: "الساعة شكلها فخم جدًا وجاتلي متغلفة كهدية. شكرًا على الاهتمام." }, { name: "عمر خالد", rating: 5, text: "تاني مرة أطلب والجودة ثابتة، والتوصيل كان في نفس المعاد." }], layout: "slider" }),
    s("gallery", { title: "@sufi.store", description: "شاركونا إطلالاتكم بهاشتاج #صوفي", items: (["women", "knit", "tshirt", "rack", "men", "store", "sunglasses", "hoodie"] as Pic[]).map((p) => ({ media_id: id(p), label: null, link: none })) }),
    s("faq", { title: "عندك سؤال؟", text: "جمعنا أكتر الأسئلة اللي بتوصلنا. لو سؤالك مش موجود كلّمنا على واتساب.", whatsapp_button: true, items: [{ question: "الشحن بياخد قد إيه؟", answer: "القاهرة والجيزة من يوم لـ 2، وباقي المحافظات من 2 لـ 4 أيام عمل." }, { question: "أقدر أستبدل أو أرجّع المنتج؟", answer: "أيوه، خلال 14 يوم من الاستلام طالما المنتج بحالته." }, { question: "الدفع بيبقى إزاي؟", answer: "عند الاستلام، أو بالكارت والمحافظ في صفحة الدفع." }] }),
    s("location", { title: "شرّفنا في فروعنا", description: "موجودين طول أيام الأسبوع من 10 ص لـ 11 م", branches: [{ name: "فرع مدينة نصر", address: "شارع عباس العقاد، مدينة نصر، القاهرة", hours: "10 ص - 11 م", phone: "0100 123 4567", map_url: "https://www.google.com/maps/@30.0626,31.3456,15z" }, { name: "فرع سموحة", address: "سموحة، الإسكندرية", hours: "11 ص - 11 م", phone: null, map_url: "https://www.google.com/maps/@31.2156,29.9553,15z" }] }),
  ],
};

const media = Object.fromEntries(IMAGES.map((name) => [String(id(name)), urls(name)]));
const CATEGORIES: Array<[string, Pic, number]> = [["رجالي", "men", 248], ["حريمي", "women", 312], ["أحذية", "sneaker", 96], ["موبايلات", "phone", 74], ["ساعات", "watch", 41], ["إكسسوارات", "sunglasses", 130]];

export const SUFI_DEMO_DATA: DesignData = {
  products: {
    "demo-product_tabs:0": [PRODUCTS[6], PRODUCTS[1], PRODUCTS[0], PRODUCTS[2], PRODUCTS[5], PRODUCTS[3]],
    "demo-product_tabs:1": [PRODUCTS[7], PRODUCTS[4], PRODUCTS[3], PRODUCTS[1], PRODUCTS[5]],
    "demo-product_tabs:2": PRODUCTS.filter((p) => p.compare_at_price),
    "demo-products": [PRODUCTS[3], PRODUCTS[4], PRODUCTS[5], PRODUCTS[7]],
  },
  view_all: { "demo-products": "/products" },
  links: {},
  media,
  categories: CATEGORIES.map(([name], i) => ({ id: i + 1, parent_id: null, name, slug: `demo-${i + 1}` })),
  pages: [{ title: "سياسة الاستبدال", slug: "returns" }, { title: "الشحن والتوصيل", slug: "shipping" }],
  reviews: [],
  ...({
    category_tiles: { "demo-categories": CATEGORIES.map(([name, pic, count], i) => ({ id: i + 1, name, slug: `demo-${i + 1}`, image: image(pic), products_count: count })) },
    featured: { "demo-featured_product": { product: FEATURED, offers: [], rating: { average: 4.9, count: 218 } } },
  } as object),
};
