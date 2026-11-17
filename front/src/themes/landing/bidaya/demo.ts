/**
 * The showcase page of «بداية»: a smart watch (pictures from «صوفي · متجر»'s showcase). What a merchant sees on the theme's «معاينة» before buying it.
 * A fixed sample (content made from the theme's own starter content), never saved to any store.
 */
import type { Content, LandingData } from "@/themes/landing/bidaya/types";

const PICTURES = [
  "/themes/store/sufi/demo/watch.jpg",
  "/themes/store/sufi/demo/phone.jpg",
];

const image = (src: string, i: number) => ({ id: i + 1, alt: null, width: null, height: null, urls: { thumb: src, medium: src, large: src } });

/** The page content (picture ids are 1, 2, 3… in PICTURES order). */
export function bidayaDemoContent(): Content {
  const content: Content = {
  version: 1,
  settings: {
    colors: {
      primary: "#0b875b",
      secondary: "#ffc83d",
      background: "#ffffff",
      text: "#13261d"
    },
    font: "cairo",
    font_size: "medium",
    button: "rounded",
    logo_media_id: null,
    header: {
      show: true,
      announcement: "شحن ببلاش لحد باب البيت لفترة محدودة"
    },
    footer: {
      text: "إكسسوارات ذكية أصلية بضمان سنة.",
      phone: null,
      whatsapp: null,
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
        title: "ساعة «نبض» الذكية",
        subtitle: "بتقيس نبضك وخطواتك ونومك، وبطاريتها بتقعد أسبوع. اطلبها دلوقتي وادفع لما توصلك.",
        image_media_id: 1,
        show_price: true,
        button_label: "اطلب دلوقتي",
        badge: "الأكثر مبيعًا"
      }
    },
    {
      id: "demo-02-features",
      type: "features",
      visible: true,
      props: {
        title: "ليه تشتريه مننا؟",
        items: [
          {
            icon: "truck",
            title: "شحن لكل المحافظات",
            text: "بنوصل طلبك لحد باب البيت."
          },
          {
            icon: "cash",
            title: "الدفع عند الاستلام",
            text: "ادفع لما طلبك يوصلك."
          },
          {
            icon: "shield",
            title: "جودة مضمونة",
            text: "افحص المنتج قبل ما تدفع."
          }
        ]
      }
    },
    {
      id: "demo-03-gallery",
      type: "gallery",
      visible: true,
      props: {
        title: "صور المنتج",
        image_media_ids: [
          1,
          2
        ]
      }
    },
    {
      id: "demo-04-testimonials",
      type: "testimonials",
      visible: true,
      props: {
        title: "آراء العملاء",
        source: "auto",
        items: []
      }
    },
    {
      id: "demo-05-faq",
      type: "faq",
      visible: true,
      props: {
        title: "أسئلة بتتسأل كتير",
        items: [
          {
            question: "الدفع إزاي؟",
            answer: "كاش عند استلام الطلب."
          },
          {
            question: "الطلب بيوصل إمتى؟",
            answer: "بنأكد طلبك بمكالمة، والتوصيل خلال أيام حسب محافظتك."
          },
          {
            question: "أقدر أفحص المنتج قبل ما أدفع؟",
            answer: "أيوه، افحصه قدام المندوب."
          }
        ]
      }
    },
    {
      id: "demo-06-order-form",
      type: "order_form",
      visible: true,
      props: {
        title: "اطلب دلوقتي",
        subtitle: "اكتب بياناتك وهنكلمك نأكد الطلب.",
        button_label: "تأكيد الطلب",
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
        show_quantity: true
      }
    }
  ]
};
  return content;
}

/** The product, its offer and the pictures the page shows. */
export const BIDAYA_DEMO_DATA: LandingData = {
  page: { id: 0, slug: "demo", title: "ساعة «نبض» الذكية" },
  store_name: "نبض",
  product: {
    id: 1,
    name: "ساعة «نبض» الذكية",
    slug: "demo",
    description: null,
    short_description: null,
    price: 1299,
    compare_at_price: 1650,
    available: true,
    stock_mode: "product",
    stock: 23,
    variant_stock: null,
    images: PICTURES.slice(0, 3).map(image),
    options: [],
  },
  offers: [{ id: 1, name: "ساعتين بسعر خاص", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 2299, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 }],
  media: Object.fromEntries(PICTURES.map((src, i) => [String(i + 1), image(src, i)])),
  reviews: [
    { name: "منى", rating: 5, text: "المنتج زي الصور بالظبط، والتوصيل كان سريع." },
    { name: "أحمد", rating: 5, text: "الجودة ممتازة، والدفع عند الاستلام ريّحني." },
    { name: "سارة", rating: 4, text: "حلو جدًا، وخدمة العملاء ردت عليا بسرعة." },
  ],
  shipping: { enabled: false },
};
