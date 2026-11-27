/**
 * The «رواق» showcase store: what a merchant sees on the theme's «معاينة» before buying it.
 * A fixed sample (pictures in public/themes/store/rawaq/demo, free Unsplash photos without brands),
 * shown only on the theme's demo page and never saved to any store.
 */
import { ar } from "@/messages/ar";
import type { DesignData, ProductCard } from "@/themes/store/shared/types";
import { RAWAQ_CARD_DEFAULTS, RAWAQ_CART_DEFAULTS, RAWAQ_LISTING_DEFAULTS, RAWAQ_PAGE_DEFAULTS, QUIZ_AI_DEFAULTS, type RawaqDesign, type RawaqSection, type SkinQuizProps } from "./types";

const IMAGES = [
  "hero",
  "vitamin-c",
  "niacinamide",
  "hyaluronic",
  "night-cream",
  "retinol",
  "argan-oil",
  "jade-roller",
  "lipstick",
  "blush",
  "oat-soap",
  "cat-hair",
  "cat-makeup",
  "cat-body",
  "banner-set",
  "banner-makeup",
  "tip-order",
  "tip-mask",
  "tip-night",
  "before",
  "after",
  "citrus",
] as const;
type Pic = (typeof IMAGES)[number];

const src = (name: Pic) => `/themes/store/rawaq/demo/${name}.jpg`;
const id = (name: Pic) => IMAGES.indexOf(name) + 1;
const urls = (name: Pic) => ({ thumb: src(name), medium: src(name), large: src(name) });
const image = (name: Pic) => ({ id: id(name), alt: null, width: null, height: null, urls: urls(name) });

const all = { type: "all_products" as const, target_id: null, url: null };
const offers = { type: "offers" as const, target_id: null, url: null };
const none = { type: "none" as const, target_id: null, url: null };
const search = (word: string) => ({ type: "search" as const, target_id: null, url: word });

function item(n: number, name: string, about: string, price: number, compare: number | null, pic: Pic, rating: number | null = null): ProductCard {
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
    rating: rating ? { average: rating, count: 40 + n * 11 } : null,
  };
}

const PRODUCTS: ProductCard[] = [
  item(1, "سيروم فيتامين C للنضارة 30 مل", "نضارة وتوحيد للون البشرة", 450, 600, "vitamin-c", 4.9),
  item(2, "سيروم نياسيناميد 10% للمسام", "يقلّل لمعان البشرة وشكل المسام", 380, null, "niacinamide", 4.8),
  item(3, "جل مرطّب بالهيالورونيك 50 مل", "ترطيب خفيف طول اليوم", 320, 380, "hyaluronic", 4.8),
  item(4, "كريم ليلي مغذّي", "ترطيب عميق وأنتي ونعومة الصبح", 520, null, "night-cream", 4.7),
  item(5, "سيروم الريتينول الليلي", "لتجديد البشرة والخطوط الرفيعة", 490, 560, "retinol", 4.6),
  item(6, "زيت الأرجان للشعر 100 مل", "لمعان ونعومة للأطراف الجافة", 290, null, "argan-oil", 4.7),
  item(7, "رول اليشم مع سيروم التهدئة", "تدليك ونضارة في دقيقتين", 650, 780, "jade-roller"),
  item(8, "روج مات بيبي روز", "لون ثابت وناعم على الشفايف", 210, null, "lipstick", 4.5),
  item(9, "بلاشر بودرة خوخي", "لون طبيعي بيدّي إشراقة", 240, 280, "blush"),
  item(10, "صابونة الشوفان الطبيعية", "لطيفة على البشرة الحساسة", 120, null, "oat-soap", 4.8),
];
const by = (...ids: number[]) => ids.map((n) => PRODUCTS[n - 1]!);

/** The theme's ready quiz (the same one a new «اختبار البشرة» starts with). */
function quiz(): SkinQuizProps {
  const s = ar.design.rawaq.quiz.starter;
  return {
    kicker: s.kicker,
    title: s.title,
    text: s.text,
    button_label: null,
    results: s.results.map((x) => ({ ...x, product_ids: [], category_id: null })),
    questions: s.questions.map((q) => ({ text: q.text, answers: q.answers.map(([text, ...results]) => ({ text, results })) })),
    ai: QUIZ_AI_DEFAULTS,
  };
}

const s = (sectionId: string, section: Omit<RawaqSection, "id" | "visible">): RawaqSection => ({ id: sectionId, visible: true, ...section }) as RawaqSection;
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export const RAWAQ_DEMO_DESIGN: RawaqDesign = {
  settings: {
    colors: { primary: "#b9507a", secondary: "#3d9a6f", background: "#fbf7f3", text: "#2b2226", dark: "#2b2226" },
    font: "cairo",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    display_font: true,
    button: "pill",
    header: { sticky: true, search: true, announcement: "توصيل مجاني للطلبات فوق 500 ج · الدفع عند الاستلام", layout: "start", categories_menu: true },
    footer: {
      about: "منتجات عناية أصلية مختارة لبشرتك وشعرك، بنساعدك تختاري الروتين المناسب ليكي.",
      show_pages: true,
      phone: "01000000000",
      whatsapp: "01000000000",
      email: null,
      address: "القاهرة",
      social: { facebook: "https://facebook.com", instagram: "https://instagram.com", tiktok: "https://tiktok.com", x: null, youtube: null, snapchat: null },
      dark: true,
      payments: true,
    },
    general: { whatsapp_button: true, show_out_of_stock: true, products_per_page: 24, floating_call: false, call_phone: null, animations: true },
    product_card: RAWAQ_CARD_DEFAULTS,
    product_page: RAWAQ_PAGE_DEFAULTS,
    listing: RAWAQ_LISTING_DEFAULTS,
    cart: RAWAQ_CART_DEFAULTS,
  },
  sections: [
    s("demo-hero", {
      type: "glow_hero",
      props: {
        kicker: "مجموعة العناية الجديدة",
        title: "بشرة صافية من أول أسبوع",
        highlight: "صافية",
        subtitle: "منتجات أصلية مختارة لنوع بشرتك، بمكونات مجرّبة وروتين بسيط تمشي عليه كل يوم.",
        media_id: id("hero"),
        badge: "خصم 30%",
        rating: "4.9 من 2,300 عميلة",
        primary_label: "تسوّقي دلوقتي",
        primary_link: all,
        second_label: "العروض",
        second_link: offers,
        chips: ["أصلي 100%", "الدفع عند الاستلام", "توصيل سريع"],
      },
    }),
    s("demo-trust", {
      type: "features",
      props: {
        title: null,
        items: [
          { icon: "shield", title: "منتجات أصلية", text: "من الوكيل مباشرة" },
          { icon: "cash", title: "الدفع عند الاستلام", text: "أو بالكارت والمحفظة" },
          { icon: "return", title: "استبدال سهل", text: "لو المنتج مقفول" },
          { icon: "truck", title: "توصيل سريع", text: "لكل المحافظات" },
        ],
      },
    }),
    s("demo-skin", {
      type: "shortcuts",
      props: {
        kicker: "ابدئي من هنا",
        title: "تسوّقي حسب نوع بشرتك وشعرك",
        description: null,
        style: "circles",
        items: [
          { label: "دهنية", text: null, media_id: id("niacinamide"), color: null, link: search("نياسيناميد") },
          { label: "جافة", text: null, media_id: id("hyaluronic"), color: null, link: search("هيالورونيك") },
          { label: "مختلطة", text: null, media_id: id("vitamin-c"), color: null, link: all },
          { label: "حساسة", text: null, media_id: id("oat-soap"), color: null, link: all },
          { label: "شعر جاف", text: null, media_id: id("argan-oil"), color: null, link: all },
          { label: "مكياج", text: null, media_id: id("blush"), color: null, link: all },
        ],
      },
    }),
    s("demo-categories", { type: "categories", props: { title: "الأقسام", description: null, category_ids: [], shape: "card", layout: "grid", columns_desktop: 4, columns_mobile: 2 } }),
    s("demo-tabs", {
      type: "product_tabs",
      props: { title: "الأكثر طلبًا", description: null, limit: 8, tabs: [{ label: "الأكثر مبيعًا", source: "latest", category_id: null, product_ids: [] }, { label: "عروض", source: "offers", category_id: null, product_ids: [] }] },
    }),
    s("demo-routine", {
      type: "routine",
      props: {
        kicker: "روتين النضارة",
        title: "3 خطوات لبشرة منوّرة",
        text: "الروتين ده متجرّب ومتنسّق: الصبح فيتامين C ومرطّب، وبالليل الكريم المغذّي. أضيفيه كله بضغطة.",
        button_label: null,
        steps: [
          { product_id: 1, label: "سيروم فيتامين C", hint: "الصبح" },
          { product_id: 3, label: "جل الهيالورونيك", hint: "الصبح وبالليل" },
          { product_id: 4, label: "الكريم الليلي", hint: "بالليل" },
        ],
      },
    }),
    s("demo-banners", {
      type: "banners",
      props: {
        items: [
          { media_id: id("banner-set"), kicker: "مجموعة الهدايا", title: "هدية لنفسك أو لحد بتحبيه", button_label: "اختاري هديتك", link: all },
          { media_id: id("banner-makeup"), kicker: "المكياج", title: "ألوان ناعمة لكل يوم", button_label: "تسوّقي المكياج", link: all },
        ],
      },
    }),
    s("demo-quiz", { type: "skin_quiz", props: quiz() }),
    s("demo-before-after", {
      type: "before_after",
      props: {
        kicker: "نتايج حقيقية",
        title: "الفرق بيبان من أول شهر",
        text: "اسحبي الخط وشوفي الفرق بعد 4 أسابيع على روتين النضارة.",
        before_media_id: id("before"),
        after_media_id: id("after"),
        before_label: "قبل",
        after_label: "بعد 4 أسابيع",
        facts: [
          { value: "92%", label: "بشرتهم بقت أنعم" },
          { value: "4", label: "أسابيع بس" },
          { value: "+2K", label: "عميلة جرّبته" },
        ],
      },
    }),
    s("demo-ingredients", {
      type: "ingredients",
      props: {
        kicker: "اعرفي اللي بتحطيه",
        title: "مكوّنات بنثق فيها",
        description: null,
        items: [
          { symbol: "C", name: "فيتامين C", text: "نضارة وتوحيد اللون", color: "#f6e2df", link: search("فيتامين C") },
          { symbol: "B3", name: "نياسيناميد", text: "يقلّل المسام والدهون", color: "#dcebe3", link: search("نياسيناميد") },
          { symbol: "HA", name: "هيالورونيك", text: "ترطيب عميق طول اليوم", color: "#e1e9f2", link: search("هيالورونيك") },
          { symbol: "A", name: "ريتينول", text: "للخطوط وتجديد البشرة", color: "#efe4d6", link: search("ريتينول") },
        ],
      },
    }),
    s("demo-countdown", {
      type: "countdown",
      props: { media_id: id("citrus"), kicker: "عرض الأسبوع", title: "خصم 25% على سيرومات فيتامين C", text: "العرض لفترة محدودة وعلى الكمية المتاحة بس.", button_label: "الحقي العرض", link: offers, ends_at: inDays(3), on_end: "hide" },
    }),
    s("demo-tips", {
      type: "articles",
      props: {
        kicker: "من خبيرة البشرة",
        title: "نصايح العناية",
        items: [
          {
            media_id: id("tip-order"),
            tag: "البشرة",
            title: "ترتيب منتجات الروتين",
            body: "ابدئي دايمًا بالأخف وخلّصي بالأتقل.\n\nالغسول الأول، بعده التونر، بعده السيروم، وفي الآخر المرطب.\n\nالصبح ماتنسيش واقي الشمس آخر خطوة، وجدّديه لو قعدتي في الشمس.",
            link: search("سيروم"),
          },
          {
            media_id: id("tip-mask"),
            tag: "العناية الأسبوعية",
            title: "الماسك مرة ولا مرتين في الأسبوع؟",
            body: "ماسك الطين بيناسب البشرة الدهنية والمختلطة مرة أو مرتين في الأسبوع.\n\nالبشرة الجافة والحساسة تكتفي بمرة، وبعده على طول مرطّب.",
            link: none,
          },
          { media_id: id("tip-night"), tag: "روتين الليل", title: "منتجات الريتينول", body: null, link: search("ريتينول") },
        ],
      },
    }),
    s("demo-reviews", { type: "testimonials", props: { title: "آراء عميلاتنا", source: "auto", items: [] } }),
    s("demo-faq", {
      type: "faq",
      props: {
        title: "عندك سؤال؟",
        text: "لو مش لاقية إجابتك كلّمينا واتساب، وبنرد في نفس اليوم.",
        whatsapp_button: true,
        items: [
          { question: "المنتجات أصلية؟", answer: "أيوه، كل المنتجات أصلية ومن الوكيل مباشرة، وبتوصلك مقفولة." },
          { question: "الطلب بيوصل في قد إيه؟", answer: "من يومين لـ 4 أيام حسب محافظتك، وبنبعتلك رقم التتبع." },
          { question: "ينفع أبدّل المنتج؟", answer: "ينفع خلال 14 يوم طالما المنتج مقفول ومتفتحش." },
          { question: "مش عارفة أختار، أعمل إيه؟", answer: "اعملي «اختبار البشرة» فوق، أو ابعتيلنا صورة بشرتك على واتساب ونساعدك." },
        ],
      },
    }),
    s("demo-cta", {
      type: "cta",
      props: { title: "خلّيكي أول واحدة تعرف العروض", text: "ابعتيلنا على واتساب ونبعتلك العروض الجديدة أول بأول.", button_label: "ابعتيلنا على واتساب", action: "whatsapp", message: "عايزة أعرف العروض الجديدة", link: none },
    }),
  ],
};

export const RAWAQ_DEMO_DATA: DesignData = {
  products: {
    "demo-tabs:0": by(1, 3, 2, 4, 6, 8, 5, 10),
    "demo-tabs:1": PRODUCTS.filter((p) => p.compare_at_price),
    "demo-routine": by(1, 3, 4),
    "demo-quiz:0": by(2, 1, 3),
    "demo-quiz:1": by(3, 4, 6),
    "demo-quiz:2": by(1, 2, 3),
    "demo-quiz:3": by(10, 3),
  },
  view_all: {},
  links: {
    "demo-hero:primary": "/products",
    "demo-hero:second": "/offers",
    "demo-skin:0": "/products?q=نياسيناميد",
    "demo-skin:1": "/products?q=هيالورونيك",
    "demo-skin:2": "/products",
    "demo-skin:3": "/products",
    "demo-skin:4": "/products",
    "demo-skin:5": "/products",
    "demo-banners:0": "/products",
    "demo-banners:1": "/products",
    "demo-quiz:0": "/products",
    "demo-quiz:1": null,
    "demo-quiz:2": null,
    "demo-quiz:3": null,
    "demo-ingredients:0": "/products?q=فيتامين C",
    "demo-ingredients:1": "/products?q=نياسيناميد",
    "demo-ingredients:2": "/products?q=هيالورونيك",
    "demo-ingredients:3": "/products?q=ريتينول",
    "demo-countdown": "/offers",
    "demo-tips:0": "/products?q=سيروم",
    "demo-tips:1": null,
    "demo-tips:2": "/products?q=ريتينول",
  },
  media: Object.fromEntries(IMAGES.map((name) => [String(id(name)), urls(name)])),
  categories: [
    { id: 1, parent_id: null, name: "العناية بالبشرة", slug: "demo-skin" },
    { id: 2, parent_id: null, name: "الشعر", slug: "demo-hair" },
    { id: 3, parent_id: null, name: "المكياج", slug: "demo-makeup" },
    { id: 4, parent_id: null, name: "الجسم", slug: "demo-body" },
  ],
  pages: [],
  reviews: [
    { name: "سلمى أحمد", rating: 5, text: "سيروم فيتامين C فرق معايا جدًا في النضارة، والتوصيل كان في يومين والمنتج مقفول." },
    { name: "نورهان محمد", rating: 5, text: "عملت اختبار البشرة واشتريت الروتين اللي طلعلي، بشرتي بقت أهدى بكتير." },
    { name: "دينا خالد", rating: 4, text: "الجل المرطّب خفيف ومش بيلمّع، مناسب جدًا للصيف." },
  ],
  ...{
    category_tiles: {
      "demo-categories": [
        { id: 1, name: "العناية بالبشرة", slug: "demo-skin", image: image("vitamin-c"), products_count: 48 },
        { id: 2, name: "الشعر", slug: "demo-hair", image: image("cat-hair"), products_count: 22 },
        { id: 3, name: "المكياج", slug: "demo-makeup", image: image("cat-makeup"), products_count: 35 },
        { id: 4, name: "الجسم", slug: "demo-body", image: image("cat-body"), products_count: 17 },
      ],
    },
  },
};
