/**
 * The showcase page of «صوفي»: a leather bag (unbranded free Unsplash photos in public/themes/landing/sufi/demo). What a merchant sees on the theme's «معاينة» before buying it.
 * A fixed sample (content made from the theme's own starter content), never saved to any store.
 */
import type { LandingData } from "@/themes/landing/bidaya/types";
import type { SufiLandingContent } from "./types";

const PICTURES = [
  "/themes/landing/sufi/demo/teal.jpg",
  "/themes/landing/sufi/demo/croc.jpg",
  "/themes/landing/sufi/demo/tote.jpg",
  "/themes/landing/sufi/demo/clutch.jpg",
  "/themes/landing/sufi/demo/backpack.jpg",
  "/themes/landing/sufi/demo/wallet.jpg",
];

const inHours = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

const image = (src: string, i: number) => ({ id: i + 1, alt: null, width: null, height: null, urls: { thumb: src, medium: src, large: src } });

/** The page content (picture ids are 1, 2, 3… in PICTURES order). */
export function sufiLandingDemoContent(): SufiLandingContent {
  const content: SufiLandingContent = {
  version: 1,
  settings: {
    colors: {
      primary: "#b9844f",
      secondary: "#17181c",
      background: "#faf8f4",
      text: "#17181c"
    },
    colors_dark: {
      primary: "#d49a60",
      secondary: "#f2f0ec",
      background: "#111215",
      text: "#f2f0ec"
    },
    appearance: {
      default: "light",
      toggle: true
    },
    font: "almarai",
    font_size: "medium",
    button: "pill",
    display_font: true,
    logo_media_id: null,
    logo_dark_media_id: null,
    header: {
      show: true,
      announcement: "شحن ببلاش لكل المحافظات لفترة محدودة",
      button_label: "اطلبيها"
    },
    footer: {
      text: "جلود طبيعية متشغولة باليد في ورشتنا.",
      phone: null,
      whatsapp: "01000000000",
      social: {
        facebook: null,
        instagram: "https://instagram.com/",
        tiktok: null,
        x: null,
        youtube: null,
        snapchat: null
      }
    },
    general: {
      sticky_order_button: true,
      whatsapp_button: false,
      animations: true
    }
  },
  sections: [
    {
      id: "demo-01-hero",
      type: "hero",
      visible: true,
      props: {
        layout: "split",
        kicker: "إصدار محدود",
        title: "شنطة جلد طبيعي تعيش معاكي سنين",
        highlight: "تعيش معاكي",
        subtitle: "جلد بقري طبيعي متشغول باليد، بخياطة مزدوجة وإكسسوارات نحاس. اطلبيها دلوقتي وادفعي لما توصلك.",
        image_media_id: 1,
        show_price: true,
        show_rating: true,
        button_label: "اطلبه دلوقتي",
        second_label: "اعرف التفاصيل",
        badges: [
          "أصلي 100%",
          "ضمان سنة",
          "الدفع عند الاستلام"
        ]
      }
    },
    {
      id: "demo-02-marquee",
      type: "marquee",
      visible: true,
      props: {
        items: [
          "خامة أصلية",
          "تغليف فاخر",
          "شحن لكل المحافظات",
          "استبدال خلال 14 يوم"
        ]
      }
    },
    {
      id: "demo-03-features",
      type: "features",
      visible: true,
      props: {
        kicker: "ليه هتحبه",
        title: "الفرق في التفاصيل",
        subtitle: null,
        items: [
          {
            icon: "gem",
            title: "جلد طبيعي 100%",
            text: "جلد بقري مدبوغ نباتي، بيحلو مع الوقت."
          },
          {
            icon: "feather",
            title: "خفيفة ومريحة",
            text: "وزنها أقل من كيلو، وحمّالة بتتظبط."
          },
          {
            icon: "award",
            title: "شغل إيد",
            text: "كل شنطة بتاخد يومين في الورشة."
          },
          {
            icon: "gift",
            title: "علبة هدية",
            text: "بتوصلك في علبة قماش جاهزة تتهادى."
          }
        ]
      }
    },
    {
      id: "demo-04-details",
      type: "details",
      visible: true,
      props: {
        kicker: "عن قرب",
        title: "اتعمل عشان يعيش معاك",
        rows: [
          {
            image_media_id: 2,
            title: "الجلد",
            text: "جلد بقري طبيعي مدبوغ نباتي من غير كيماويات، لونه بيغمق بهدوء مع الاستعمال ويكسب شخصية.",
            points: [
              "سُمك 1.6 مم",
              "لمسة نهائية بالشمع"
            ]
          },
          {
            image_media_id: 3,
            title: "التفاصيل",
            text: "خياطة مزدوجة بخيط مشمّع، وإكسسوارات نحاس ما بتصدّيش، وبطانة قطن من جوه بجيبين.",
            points: [
              "قفل نحاس مصمت",
              "جيب داخلي بسوستة"
            ]
          }
        ]
      }
    },
    {
      id: "demo-05-specs",
      type: "specs",
      visible: true,
      props: {
        kicker: null,
        title: "المواصفات",
        image_media_id: 4,
        rows: [
          {
            label: "الخامة",
            value: "جلد بقري طبيعي"
          },
          {
            label: "المقاس",
            value: "28 × 20 × 11 سم"
          },
          {
            label: "الوزن",
            value: "850 جرام"
          },
          {
            label: "الألوان",
            value: "بترولي · نبيتي · أسود"
          },
          {
            label: "الضمان",
            value: "سنة على الخياطة"
          }
        ],
        note: null
      }
    },
    {
      id: "demo-06-gallery",
      type: "gallery",
      visible: true,
      props: {
        kicker: null,
        title: "من كل زاوية",
        image_media_ids: [
          1,
          2,
          3,
          4,
          5,
          6
        ]
      }
    },
    {
      id: "demo-07-bundles",
      type: "bundles",
      visible: true,
      props: {
        kicker: null,
        title: "اختار العرض اللي يناسبك",
        subtitle: null,
        cards: []
      }
    },
    {
      id: "demo-08-stats",
      type: "stats",
      visible: true,
      props: {
        kicker: null,
        title: null,
        items: [
          {
            value: "+12 ألف",
            label: "شنطة اتباعت"
          },
          {
            value: "4.9",
            label: "تقييم العملاء"
          },
          {
            value: "27",
            label: "سنة خبرة"
          },
          {
            value: "14 يوم",
            label: "استبدال"
          }
        ]
      }
    },
    {
      id: "demo-09-testimonials",
      type: "testimonials",
      visible: true,
      props: {
        kicker: null,
        title: "اللي جرّبوه بيقولوا",
        source: "manual",
        items: [
          {
            name: "منة الله",
            place: "القاهرة",
            rating: 5,
            text: "الجلد تقيل وريحته حلوة، والخياطة نضيفة جدًا. أحلى من صورها.",
            image_media_id: null
          },
          {
            name: "ريم",
            place: "الإسكندرية",
            rating: 5,
            text: "وصلت في علبة شيك، ولونها البترولي يجنن على الطبيعة.",
            image_media_id: null
          },
          {
            name: "سلمى",
            place: "المنصورة",
            rating: 4,
            text: "مقاسها مظبوط للشغل والخروج، وبتشيل كل حاجتي.",
            image_media_id: null
          }
        ],
        show_score: true
      }
    },
    {
      id: "demo-10-countdown",
      type: "countdown",
      visible: true,
      props: {
        kicker: "عرض الموسم",
        title: "الخصم بيخلص قريب",
        text: "الكمية محدودة، ومش هنعيد الإنتاج قبل الشتا.",
        ends_at: null,
        show_stock: true
      }
    },
    {
      id: "demo-11-order-form",
      type: "order_form",
      visible: true,
      props: {
        kicker: "الدفع عند الاستلام",
        title: "اطلبه دلوقتي",
        subtitle: "اكتب بياناتك وهنكلمك نأكد الطلب قبل الشحن.",
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
          "أصلي 100%",
          "تغليف فاخر",
          "استبدال خلال 14 يوم"
        ],
        image_media_id: null
      }
    },
    {
      id: "demo-12-promises",
      type: "promises",
      visible: true,
      props: {
        items: [
          {
            icon: "truck",
            title: "شحن لكل المحافظات",
            text: "بيوصلك من يومين لـ 4 أيام."
          },
          {
            icon: "cash",
            title: "الدفع عند الاستلام",
            text: "تشوفه الأول وبعدين تدفع."
          },
          {
            icon: "return",
            title: "استبدال سهل",
            text: "خلال 14 يوم طالما بحالته."
          }
        ]
      }
    },
    {
      id: "demo-13-faq",
      type: "faq",
      visible: true,
      props: {
        kicker: null,
        title: "أسئلة بتتسأل كتير",
        items: [
          {
            question: "المنتج أصلي؟",
            answer: "أيوه، أصلي 100% وبضمان."
          },
          {
            question: "الشحن بياخد قد إيه؟",
            answer: "من يومين لـ 4 أيام عمل حسب المحافظة."
          },
          {
            question: "الدفع بيبقى إزاي؟",
            answer: "كاش عند الاستلام، بعد ما تشوف المنتج."
          }
        ]
      }
    }
  ]
};
  for (const s of content.sections) if (s.type === "countdown") s.props.ends_at = inHours(53);
  return content;
}

/** The product, its offer and the pictures the page shows. */
export const SUFI_LANDING_DEMO_DATA: LandingData = {
  page: { id: 0, slug: "demo", title: "شنطة يد جلد طبيعي" },
  store_name: "دار الجلود",
  product: {
    id: 1,
    name: "شنطة يد جلد طبيعي",
    slug: "demo",
    description: null,
    short_description: null,
    price: 2450,
    compare_at_price: 3200,
    available: true,
    stock_mode: "product",
    stock: 9,
    variant_stock: null,
    images: PICTURES.slice(0, 3).map(image),
    options: [],
  },
  offers: [{ id: 1, name: "شنطتين بسعر خاص", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 4300, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 }],
  media: Object.fromEntries(PICTURES.map((src, i) => [String(i + 1), image(src, i)])),
  reviews: [
    { name: "منى", rating: 5, text: "المنتج زي الصور بالظبط، والتوصيل كان سريع." },
    { name: "أحمد", rating: 5, text: "الجودة ممتازة، والدفع عند الاستلام ريّحني." },
    { name: "سارة", rating: 4, text: "حلو جدًا، وخدمة العملاء ردت عليا بسرعة." },
  ],
  shipping: { enabled: false },
};
