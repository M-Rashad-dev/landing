/**
 * The showcase page of «شابع»: a grill box (pictures from «شابع · متجر»'s showcase): what a merchant sees on the theme's «معاينة» before buying it.
 * A fixed sample (content made from the theme's own starter content), never saved to any store.
 */
import type { LandingData } from "@/themes/landing/bidaya/types";
import type { ShabeContent } from "./types";

const PICTURES = [
  "/themes/store/shabe/demo/grill-box.jpg",
  "/themes/store/shabe/demo/kofta.jpg",
  "/themes/store/shabe/demo/kebab.jpg",
  "/themes/store/shabe/demo/shish.jpg",
  "/themes/store/shabe/demo/chicken.jpg",
  "/themes/store/shabe/demo/ribs.jpg",
  "/themes/store/shabe/demo/kabsa.jpg",
  "/themes/store/shabe/demo/platters.jpg",
];

const inHours = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

const image = (src: string, i: number) => ({ id: i + 1, alt: null, width: null, height: null, urls: { thumb: src, medium: src, large: src } });

/** The page content (picture ids are 1, 2, 3… in PICTURES order). */
export function shabeDemoContent(): ShabeContent {
  const content: ShabeContent = {
  version: 1,
  settings: {
    colors: {
      primary: "#e4572e",
      secondary: "#f2b33d",
      background: "#fffaf2",
      text: "#1b120c",
      dark: "#17110d"
    },
    font: "cairo",
    font_size: "medium",
    button: "rounded",
    display_font: true,
    logo_media_id: null,
    header: {
      show: true,
      announcement: "عرض الافتتاح: التوصيل ببلاش لأول طلب",
      countdown_ends_at: null,
      phone: "19999",
      button_label: "اطلب دلوقتي"
    },
    footer: {
      text: "مطبخ بيتي بيشوي على الفحم ساعة الطلب.",
      phone: null,
      whatsapp: "01000000000",
      social: {
        facebook: null,
        instagram: null,
        tiktok: null,
        x: null,
        youtube: null,
        snapchat: null
      }
    },
    general: {
      sticky_order_button: true,
      whatsapp_button: false
    }
  },
  sections: [
    {
      id: "demo-01-hero",
      type: "hero",
      visible: true,
      props: {
        kicker: "طازة كل يوم · بيوصلك سخن",
        title: "بوكس مشويات شابع يكفّي العيلة ويزيد",
        highlight: "شابع",
        subtitle: "أكل بيتي متعمل ساعة الطلب، بيوصلك سخن لحد باب البيت، والدفع عند الاستلام.",
        image_media_id: 1,
        stickers: [
          "طازة كل يوم",
          "بيوصلك سخن"
        ],
        badge: "النهارده بس",
        show_price: true,
        show_rating: true,
        button_label: "اطلب دلوقتي",
        second_label: "شوف اللي فيها",
        trust: [
          {
            icon: "bike",
            text: "توصيل في نفس اليوم"
          },
          {
            icon: "cash",
            text: "ادفع لما يوصلك"
          },
          {
            icon: "thermo",
            text: "بيوصل سخن"
          }
        ]
      }
    },
    {
      id: "demo-02-marquee",
      type: "marquee",
      visible: true,
      props: {
        items: [
          "مكونات طازة",
          "متعمل ساعة الطلب",
          "الدفع عند الاستلام",
          "توصيل سريع"
        ]
      }
    },
    {
      id: "demo-03-menu",
      type: "menu",
      visible: true,
      props: {
        kicker: null,
        title: "إيه اللي جوه؟",
        subtitle: "كل صنف بوزنه، ومفيش حاجة مستخبية",
        items: [
          {
            image_media_id: 2,
            title: "كفتة مشوية",
            text: "لحمة بلدي بالبصل والبقدونس",
            tag: "½ كيلو"
          },
          {
            image_media_id: 3,
            title: "كباب ضاني",
            text: "متبّل ٢٤ ساعة",
            tag: "½ كيلو"
          },
          {
            image_media_id: 4,
            title: "شيش طاووق",
            text: "بالزبادي والليمون",
            tag: "٨ أسياخ"
          },
          {
            image_media_id: 5,
            title: "فراخ مشوية",
            text: "على الفحم",
            tag: "فرخة كاملة"
          }
        ],
        extras: [
          "عيش",
          "سلطة خضرا",
          "صوصات"
        ]
      }
    },
    {
      id: "demo-04-why",
      type: "why",
      visible: true,
      props: {
        kicker: "ليه إحنا؟",
        title: "الطعم اللي بتحبه، من غير مشوار",
        subtitle: null,
        image_media_id: 6,
        quote: "«بنشوي كل بوكس ساعة ما بتطلبه»",
        items: [
          {
            icon: "leaf",
            title: "مكونات طازة",
            text: "بنشتري كل يوم، مفيش مجمد."
          },
          {
            icon: "chef",
            title: "وصفة البيت",
            text: "نفس الطعم كل مرة."
          },
          {
            icon: "thermo",
            title: "بيوصل سخن",
            text: "علب حافظة للحرارة لحد باب البيت."
          },
          {
            icon: "shield",
            title: "مطبخ نضيف",
            text: "نضافة ومراجعة كل يوم."
          }
        ]
      }
    },
    {
      id: "demo-05-steps",
      type: "steps",
      visible: true,
      props: {
        kicker: null,
        title: "٣ خطوات وتبقى شابع",
        items: [
          {
            icon: "package",
            title: "اطلب من الفورم",
            text: "اختار واكتب عنوانك، من غير تسجيل ولا دفع أونلاين."
          },
          {
            icon: "phone",
            title: "نكلمك نأكد",
            text: "نتصل نأكد الطلب ومعاد التوصيل."
          },
          {
            icon: "bike",
            title: "يوصلك سخن",
            text: "تستلم وتدفع للمندوب."
          }
        ]
      }
    },
    {
      id: "demo-06-bundles",
      type: "bundles",
      visible: true,
      props: {
        kicker: null,
        title: "اختار اللي على قد لمّتك",
        subtitle: null,
        cards: []
      }
    },
    {
      id: "demo-07-gallery",
      type: "gallery",
      visible: true,
      props: {
        title: "من المطبخ لسفرتك",
        image_media_ids: [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ]
      }
    },
    {
      id: "demo-08-testimonials",
      type: "testimonials",
      visible: true,
      props: {
        kicker: null,
        title: "كلام اللي جرّبوا",
        source: "manual",
        items: [
          {
            name: "أحمد",
            place: "مدينة نصر",
            rating: 5,
            text: "الكفتة طعمها بيتي بجد، ووصلت سخنة.",
            image_media_id: null
          },
          {
            name: "مريم",
            place: "المعادي",
            rating: 5,
            text: "البوكس كفّانا خمسة وزيادة، والفحم باين في الطعم.",
            image_media_id: null
          },
          {
            name: "كريم",
            place: "الشيخ زايد",
            rating: 4,
            text: "التوصيل أخد ساعة بس الأكل يستاهل.",
            image_media_id: null
          }
        ],
        show_score: true
      }
    },
    {
      id: "demo-09-compare",
      type: "compare",
      visible: true,
      props: {
        title: "شابع ولا الطلب العادي؟",
        us: "بوكس شابع",
        them: "مطعم عادي",
        rows: [
          {
            label: "سعر الفرد",
            us: "≈ 180 ج.م",
            them: "≈ 290 ج.م"
          },
          {
            label: "مشوي على الفحم",
            us: "✓",
            them: "غالبًا جريل غاز"
          },
          {
            label: "الدفع",
            us: "عند الاستلام",
            them: "مقدّم أحيانًا"
          }
        ]
      }
    },
    {
      id: "demo-10-urgency",
      type: "urgency",
      visible: true,
      props: {
        title: "العرض بيخلص النهارده بالليل",
        text: null,
        ends_at: null,
        show_stock: true
      }
    },
    {
      id: "demo-11-order-form",
      type: "order_form",
      visible: true,
      props: {
        kicker: "من غير دفع أونلاين",
        title: "اطلب دلوقتي",
        subtitle: "اكتب بياناتك وهنكلمك نأكد الطلب.",
        button_label: "أكّد الطلب",
        fields: {
          name: {
            enabled: true,
            required: true
          },
          phone: {
            enabled: true,
            required: true
          },
          phone2: {
            enabled: false,
            required: false
          },
          email: {
            enabled: false,
            required: false
          },
          governorate: {
            enabled: true,
            required: true
          },
          city: {
            enabled: true,
            required: false
          },
          address: {
            enabled: true,
            required: true
          },
          notes: {
            enabled: true,
            required: false
          }
        },
        offer_picker: true,
        show_quantity: true,
        points: [
          "متعمل ساعة الطلب",
          "بيوصل سخن",
          "الدفع عند الاستلام"
        ],
        image_media_id: null
      }
    },
    {
      id: "demo-12-guarantee",
      type: "guarantee",
      visible: true,
      props: {
        icon: "shield",
        title: "لو مش عاجبك، حقك محفوظ",
        text: "لو الطلب وصل بارد أو فيه حاجة مش مظبوطة، كلمنا في نفس اليوم ونعوّضك."
      }
    },
    {
      id: "demo-13-faq",
      type: "faq",
      visible: true,
      props: {
        title: "عندك سؤال؟",
        items: [
          {
            question: "الطلب بيوصل في قد إيه؟",
            answer: "بنأكد طلبك بمكالمة ونحدد معاد التوصيل معاك."
          },
          {
            question: "الدفع بيبقى إزاي؟",
            answer: "كاش عند استلام الطلب."
          }
        ]
      }
    }
  ]
};
  content.settings.header.countdown_ends_at = inHours(5);
  for (const s of content.sections) if (s.type === "urgency") s.props.ends_at = inHours(5);
  return content;
}

/** The product, its offer and the pictures the page shows. */
export const SHABE_DEMO_DATA: LandingData = {
  page: { id: 0, slug: "demo", title: "بوكس مشويات العيلة" },
  store_name: "شابع",
  product: {
    id: 1,
    name: "بوكس مشويات العيلة",
    slug: "demo",
    description: null,
    short_description: null,
    price: 899,
    compare_at_price: 1150,
    available: true,
    stock_mode: "product",
    stock: 17,
    variant_stock: null,
    images: PICTURES.slice(0, 3).map(image),
    options: [],
  },
  offers: [{ id: 1, name: "بوكسين للعزومة", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 1650, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 }],
  media: Object.fromEntries(PICTURES.map((src, i) => [String(i + 1), image(src, i)])),
  reviews: [
    { name: "منى", rating: 5, text: "المنتج زي الصور بالظبط، والتوصيل كان سريع." },
    { name: "أحمد", rating: 5, text: "الجودة ممتازة، والدفع عند الاستلام ريّحني." },
    { name: "سارة", rating: 4, text: "حلو جدًا، وخدمة العملاء ردت عليا بسرعة." },
  ],
  shipping: { enabled: false },
};
