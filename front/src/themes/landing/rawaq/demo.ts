/**
 * The showcase page of «رواق»: a vitamin C serum. What a merchant sees on the theme's «معاينة» before
 * buying it. A fixed sample (the store showcase's free Unsplash photos without brands, in
 * public/themes/store/rawaq/demo), never saved to any store.
 */
import type { Content, LandingData } from "@/themes/landing/bidaya/types";
import type { RawaqLandingContent } from "./types";

const PICTURES = ["vitamin-c", "retinol", "tip-order", "hero", "before", "after", "hyaluronic", "jade-roller", "citrus"] as const;
type Pic = (typeof PICTURES)[number];

const src = (name: Pic) => `/themes/store/rawaq/demo/${name}.jpg`;
const id = (name: Pic) => PICTURES.indexOf(name) + 1;
const image = (name: Pic) => ({ id: id(name), alt: null, width: null, height: null, urls: { thumb: src(name), medium: src(name), large: src(name) } });
const inHours = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

/** The page content (picture ids are 1, 2, 3… in PICTURES order). */
export function rawaqLandingDemoContent(): Content {
  const content: RawaqLandingContent = {
    version: 1,
    settings: {
      colors: { primary: "#b9507a", secondary: "#3d9a6f", background: "#fbf7f3", text: "#2b2226", dark: "#2b2226" },
      font: "cairo",
      font_size: "medium",
      button: "pill",
      display_font: true,
      logo_media_id: null,
      header: { show: true, announcement: "توصيل مجاني لكل المحافظات · الدفع عند الاستلام", button_label: "اطلبيه دلوقتي" },
      footer: {
        text: "منتجات عناية أصلية مختارة لبشرتك، وبنرد على أسئلتك واتساب.",
        phone: null,
        whatsapp: "01000000000",
        social: { facebook: null, instagram: "https://instagram.com/", tiktok: "https://tiktok.com/", x: null, youtube: null, snapchat: null },
      },
      general: { sticky_order_button: true, whatsapp_button: false, animations: true },
    },
    sections: [
      {
        id: "demo-01-hero",
        type: "hero",
        visible: true,
        props: {
          kicker: "الأكثر مبيعًا عندنا",
          title: "سيروم فيتامين C لبشرة منوّرة من أول أسبوع",
          highlight: "منوّرة",
          subtitle: "سيروم خفيف بفيتامين C الثابت بيدّي بشرتك نضارة ويساعد على توحيد لونها. اطلبيه دلوقتي وادفعي لما يوصلك.",
          image_media_id: id("hero"),
          badge: "خصم 25%",
          show_price: true,
          show_rating: true,
          button_label: "اطلبيه دلوقتي",
          second_label: "اعرفي أكتر",
          chips: ["أصلي 100%", "الدفع عند الاستلام", "توصيل سريع"],
        },
      },
      {
        id: "demo-02-trust",
        type: "trust",
        visible: true,
        props: {
          items: [
            { icon: "shield", title: "أصلي 100%", text: "من الوكيل مباشرة" },
            { icon: "cash", title: "الدفع عند الاستلام", text: "تشوفيه الأول" },
            { icon: "truck", title: "توصيل سريع", text: "لكل المحافظات" },
            { icon: "return", title: "استبدال سهل", text: "خلال 14 يوم" },
          ],
        },
      },
      {
        id: "demo-03-benefits",
        type: "benefits",
        visible: true,
        props: {
          kicker: "هتلاحظي الفرق",
          title: "بيساعدك في إيه؟",
          items: [
            { icon: "sparkle", title: "نضارة", text: "بشرة منوّرة وشكلها صحي من أول أسبوعين.", color: "#f6e2df" },
            { icon: "sun", title: "توحيد اللون", text: "بيساعد يقلّل شكل البقع والبهتان.", color: "#efe4d6" },
            { icon: "droplet", title: "ترطيب خفيف", text: "مش بيلمّع ومناسب للصيف.", color: "#e1e9f2" },
            { icon: "smile", title: "ملمس ناعم", text: "البشرة بتبقى أنعم مع الاستخدام المنتظم.", color: "#dcebe3" },
          ],
        },
      },
      {
        id: "demo-04-before",
        type: "before_after",
        visible: true,
        props: {
          kicker: "نتايج حقيقية",
          title: "الفرق بيبان من أول شهر",
          text: "اسحبي الخط وشوفي الفرق بعد 4 أسابيع من الاستخدام الصبح.",
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
      },
      {
        id: "demo-05-ingredients",
        type: "ingredients",
        visible: true,
        props: {
          kicker: "اعرفي اللي بتحطيه",
          title: "المكوّنات",
          subtitle: null,
          items: [
            { symbol: "C", name: "فيتامين C 15%", text: "نضارة وتوحيد اللون", color: "#f6e2df" },
            { symbol: "E", name: "فيتامين E", text: "بيحمي ويغذّي البشرة", color: "#efe4d6" },
            { symbol: "HA", name: "هيالورونيك", text: "ترطيب خفيف طول اليوم", color: "#e1e9f2" },
            { symbol: "FA", name: "حمض الفيروليك", text: "بيثبّت فيتامين C", color: "#dcebe3" },
          ],
        },
      },
      {
        id: "demo-06-how",
        type: "how_to",
        visible: true,
        props: {
          kicker: "سهل جدًا",
          title: "طريقة الاستخدام",
          image_media_id: id("retinol"),
          steps: [
            { title: "نضّفي بشرتك", text: "اغسلي وشك بالغسول ونشّفيه بالراحة.", time: "الصبح" },
            { title: "3 نقط بس", text: "وزّعيهم على الوش والرقبة بأطراف صوابعك.", time: null },
            { title: "مرطب وواقي شمس", text: "استني دقيقة لحد ما يتشرب، وبعده المرطب وواقي الشمس.", time: null },
          ],
          note: "لو بشرتك حساسة، ابدئي يوم ويوم أول أسبوع.",
        },
      },
      {
        id: "demo-07-suits",
        type: "suits",
        visible: true,
        props: { title: "مناسب لـ", items: ["كل أنواع البشرة", "البشرة الباهتة", "البقع والتصبّغات", "الرجالة والستات"], note: null },
      },
      { id: "demo-08-bundles", type: "bundles", visible: true, props: { kicker: "وفّري أكتر", title: "اختاري العرض اللي يناسبك", subtitle: null, cards: [] } },
      {
        id: "demo-09-stats",
        type: "stats",
        visible: true,
        props: {
          kicker: null,
          title: null,
          items: [
            { value: "+2K", label: "عميلة جرّبته" },
            { value: "4.9", label: "متوسط التقييم" },
            { value: "30", label: "مل، تكفي شهرين" },
          ],
        },
      },
      { id: "demo-10-reviews", type: "testimonials", visible: true, props: { kicker: null, title: "آراء عميلاتنا", source: "auto", items: [], show_score: true } },
      { id: "demo-11-countdown", type: "countdown", visible: true, props: { kicker: "عرض الأسبوع", title: "الخصم بيخلص قريب", text: "السعر ده لفترة محدودة وعلى الكمية المتاحة بس.", ends_at: inHours(52), show_stock: true } },
      {
        id: "demo-12-order",
        type: "order_form",
        visible: true,
        props: {
          kicker: "الدفع عند الاستلام",
          title: "اطلبيه دلوقتي",
          subtitle: "اكتبي بياناتك وهنكلمك نأكد الطلب قبل الشحن.",
          button_label: "أكّدي الطلب",
          fields: {
            name: { enabled: true, required: true },
            phone: { enabled: true, required: true },
            phone2: { enabled: false, required: false },
            email: { enabled: false, required: false },
            governorate: { enabled: true, required: true },
            city: { enabled: false, required: false },
            address: { enabled: true, required: true },
            notes: { enabled: false, required: false },
          },
          offer_picker: true,
          show_quantity: true,
          points: ["أصلي 100%", "بيوصلك مقفول", "استبدال خلال 14 يوم"],
          image_media_id: null,
        },
      },
      {
        id: "demo-13-promises",
        type: "promises",
        visible: true,
        props: {
          items: [
            { icon: "truck", title: "توصيل لكل المحافظات", text: "بيوصلك من يومين لـ 4 أيام." },
            { icon: "cash", title: "الدفع عند الاستلام", text: "تشوفيه الأول وبعدين تدفعي." },
            { icon: "return", title: "استبدال سهل", text: "خلال 14 يوم طالما مقفول." },
          ],
        },
      },
      {
        id: "demo-14-faq",
        type: "faq",
        visible: true,
        props: {
          kicker: null,
          title: "عندك سؤال؟",
          items: [
            { question: "المنتج أصلي؟", answer: "أيوه، أصلي 100% ومن الوكيل مباشرة، وبيوصلك مقفول." },
            { question: "هيبان النتيجة إمتى؟", answer: "أغلب العميلات بيلاحظوا نضارة من أول أسبوعين مع الاستخدام كل يوم الصبح." },
            { question: "ينفع مع البشرة الحساسة؟", answer: "أيوه، ابدئي يوم ويوم أول أسبوع، وجرّبيه على مساحة صغيرة الأول." },
            { question: "الدفع بيبقى إزاي؟", answer: "كاش عند الاستلام، بعد ما تستلمي المنتج." },
          ],
        },
      },
    ],
  };
  return content as unknown as Content;
}

export const RAWAQ_LANDING_DEMO_DATA: LandingData = {
  page: { id: 0, slug: "demo", title: "سيروم فيتامين C" },
  store_name: "رواق",
  product: {
    id: 1,
    name: "سيروم فيتامين C للنضارة 30 مل",
    slug: "demo",
    description: null,
    short_description: null,
    price: 450,
    compare_at_price: 600,
    available: true,
    stock_mode: "product",
    stock: 14,
    variant_stock: null,
    images: (["vitamin-c", "retinol", "tip-order"] as const).map(image),
    options: [],
  },
  offers: [{ id: 1, name: "عبوتين بسعر خاص", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 820, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 }],
  media: Object.fromEntries(PICTURES.map((name) => [String(id(name)), image(name)])),
  reviews: [
    { name: "سلمى", rating: 5, text: "بشرتي بقت منوّرة فعلًا من أسبوعين، والتوصيل كان سريع." },
    { name: "نورهان", rating: 5, text: "خفيف جدًا ومش بيلمّع، وأخدت العرض بتاع العبوتين." },
    { name: "دينا", rating: 4, text: "حلو جدًا، والبقع بتخف بالتدريج. هكمّل عليه." },
  ],
  shipping: { enabled: false },
};
