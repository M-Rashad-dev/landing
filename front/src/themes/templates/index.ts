import { defaultProps } from "@/themes/shared/schemas";
import type { ComponentType, PageContent, PageDesign } from "@/themes/types";

/**
 * Ready page templates per niche («القوالب الجاهزة»): a theme, a page-only look (colors, fonts,
 * button shape) and the sections a page in that niche needs, with real Egyptian copy.
 * Props listed here are merged over each section's schema defaults; images come from the
 * merchant's product, so templates carry no media.
 */
export type TemplateNiche = "fashion" | "beauty" | "electronics" | "home" | "kids" | "health" | "luxury";

type TemplateSection = { type: ComponentType; variant: string; props?: Record<string, unknown> };

export type PageTemplate = {
  key: string;
  niche: TemplateNiche;
  themeKey: "malak" | "celia" | "layali";
  design: PageDesign;
  sections: TemplateSection[];
};

const faq = (items: Array<[string, string]>) => items.map(([question, answer]) => ({ question, answer }));
const features = (items: Array<[string, string, string]>) => items.map(([icon, title, description]) => ({ icon, title, description, image_media_id: null }));
const reviews = (items: Array<[string, string, string, number]>) => items.map(([name, subtitle, text, rating]) => ({ name, subtitle, text, rating, avatar_media_id: null, proof_media_id: null }));
const badges = (items: string[]) => items.map((text) => ({ text }));
const highlights = (items: Array<[string, string]>) => items.map(([icon, text]) => ({ icon, text }));

export const TEMPLATES: PageTemplate[] = [
  {
    key: "fashion-bold",
    niche: "fashion",
    themeKey: "celia",
    design: {
      colors: { primary: "#C8401C", primary_foreground: "#FFFFFF", secondary: "#FFF1EC", accent: "#FFD23F", background: "#FFFFFF", foreground: "#111111", muted: "#5C5C5C", border: "#E6E6E6" },
      font_heading: "readex_pro",
      font_body: "ibm_plex_arabic",
      button_radius: "none",
    },
    sections: [
      { type: "header", variant: "bar", props: { announcement_enabled: true, announcement_text: "شحن مجاني للطلبات فوق 1000 جنيه 🚚" } },
      { type: "hero", variant: "big-type", props: { eyebrow: "الكولكشن الجديد", title: "خامة تقيلة وقَصّة تفرق", subtitle: "قطن مصري 100% بيعيش معاك، بمقاسات من M لحد 3XL والدفع عند الاستلام.", cta_label: "اختار مقاسك", badges: badges(["قطن 100%", "استبدال مجاني", "دفع عند الاستلام"]) } },
      { type: "gallery", variant: "thumbs-side", props: { title: "شوف الخامة من قريب" } },
      { type: "product_showcase", variant: "split-image", props: { highlights: highlights([["feather", "خفيف ومريح طول اليوم"], ["refresh", "لونه ثابت بعد الغسيل"], ["ruler", "مقاسات مظبوطة على الجسم المصري"]]), cta_label: "اطلب مقاسك دلوقتي" } },
      { type: "size_chart", variant: "table" },
      { type: "features", variant: "numbered-grid", props: { title: "ليه هتحبه؟", items: features([["leaf", "قطن مصري طبيعي", "بيسيب الجسم يتنفس في الحر والبرد."], ["shield_check", "خياطة مزدوجة", "مش هتفك ولا هتكرمش بعد كام غسلة."], ["undo", "استبدال المقاس مجانًا", "لو المقاس مش مظبوط بنبدلهولك من غير مصاريف."]]) } },
      { type: "offers", variant: "bundle-tiles", props: { title: "كل ما تزوّد، توفّر أكتر" } },
      { type: "testimonials", variant: "quote-wall", props: { title: "اللي لبسوه قالوا", items: reviews([["كريم", "القاهرة", "الخامة أحسن من المحلات اللي بشتري منها، والمقاس مظبوط بالظبط زي الجدول.", 5], ["يوسف", "المنصورة", "طلبت اتنين ورجعت طلبت تالت. اللون ما اتغيرش بعد الغسيل.", 5], ["مازن", "الإسكندرية", "التوصيل كان سريع والتغليف محترم.", 4]]) } },
      { type: "faq", variant: "accordion-lines", props: { items: faq([["إزاي أعرف مقاسي؟", "قيس صدرك وقارنه بجدول المقاسات فوق. لو بين مقاسين اختار الأكبر."], ["لو المقاس طلع مش مظبوط؟", "بنبدلهولك مجانًا خلال 14 يوم من الاستلام."], ["الدفع إزاي؟", "كاش عند الاستلام، وتقدر تقيس قبل ما تدفع."]]) } },
      { type: "order_form", variant: "bordered", props: { title: "اطلب دلوقتي والدفع عند الاستلام" } },
      { type: "sticky_cta", variant: "full-bar", props: { cta_label: "اختار مقاسك واطلب" } },
      { type: "footer", variant: "dark-columns" },
    ],
  },
  {
    key: "beauty-soft",
    niche: "beauty",
    themeKey: "malak",
    design: {
      colors: { primary: "#C2416B", primary_foreground: "#FFFFFF", secondary: "#FDF1F4", accent: "#E8A33D", background: "#FFFBFA", foreground: "#2B1B22", muted: "#7A6670", border: "#F1DDE3" },
      font_heading: "almarai",
      font_body: "tajawal",
      button_radius: "full",
    },
    sections: [
      { type: "header", variant: "centered-logo" },
      { type: "hero", variant: "split", props: { eyebrow: "عناية طبيعية", title: "بشرة أنعم ونضارة تبان من أول أسبوع", subtitle: "تركيبة بمكونات طبيعية مناسبة لكل أنواع البشرة، من غير بارابين ولا عطور مصنّعة.", cta_label: "اطلبيه دلوقتي", badges: badges(["مكونات طبيعية", "مجرَّب جلديًا", "دفع عند الاستلام"]) } },
      { type: "before_after", variant: "drag-slider", props: { title: "النتيجة بعد 14 يوم", subtitle: "اسحبي الخط وشوفي الفرق بنفسك" } },
      { type: "features", variant: "icon-cards", props: { title: "سر النتيجة", items: features([["leaf", "مكونات طبيعية", "زيت الأرجان وفيتامين E والصبار."], ["droplet", "ترطيب 24 ساعة", "بيتشرب بسرعة ومش بيسيب لمعة دهنية."], ["sparkles", "نضارة من أول أسبوع", "البقع بتفتح والبشرة بتبقى موحّدة."]]) } },
      { type: "video", variant: "framed", props: { title: "طريقة الاستخدام في دقيقة" } },
      { type: "testimonials", variant: "cards-slider", props: { title: "تجارب حقيقية", items: reviews([["منى", "الجيزة", "من أول أسبوع لاحظت إن بشرتي بقت أنعم والهالات خفّت.", 5], ["سلمى", "طنطا", "ريحته خفيفة ومش بيعمل حبوب زي منتجات تانية جربتها.", 5], ["نهى", "أسيوط", "الشحن وصل في يومين والعلبة شكلها هدية.", 5]]) } },
      { type: "countdown", variant: "boxes", props: { title: "خصم الإطلاق لفترة محدودة", subtitle: "العرض بيخلص قريب، الحقي اطلبي قبل ما الوقت يخلص", minutes: 180 } },
      { type: "offers", variant: "cards", props: { title: "عروض توفّر عليكي" } },
      { type: "faq", variant: "accordion-soft", props: { items: faq([["مناسب للبشرة الحساسة؟", "أيوه، التركيبة خالية من العطور المصنّعة والبارابين."], ["أستخدمه إمتى؟", "مرتين في اليوم على بشرة نضيفة، الصبح وقبل النوم."], ["النتيجة بتبان إمتى؟", "أغلب العميلات بيلاحظوا الفرق خلال أسبوع لأسبوعين."]]) } },
      { type: "order_form", variant: "card", props: { title: "اطلبي دلوقتي والدفع عند الاستلام" } },
      { type: "sticky_cta", variant: "pill", props: { cta_label: "اطلبيه دلوقتي" } },
      { type: "footer", variant: "simple-center" },
    ],
  },
  {
    key: "electronics-tech",
    niche: "electronics",
    themeKey: "celia",
    design: {
      colors: { primary: "#1D4ED8", primary_foreground: "#FFFFFF", secondary: "#EEF3FF", accent: "#22D3EE", background: "#FFFFFF", foreground: "#0B1220", muted: "#4B5563", border: "#E2E8F0" },
      font_heading: "noto_kufi",
      font_body: "ibm_plex_arabic",
      button_radius: "sm",
    },
    sections: [
      { type: "header", variant: "minimal" },
      { type: "hero", variant: "split-reverse", props: { eyebrow: "ضمان سنة كاملة", title: "تقنية تستاهل كل جنيه", subtitle: "بطارية بتكمّل معاك يومين، شاشة واضحة في الشمس، وضمان استبدال سنة.", cta_label: "اطلب بالدفع عند الاستلام", badges: badges(["ضمان سنة", "شحن 48 ساعة", "فحص قبل الدفع"]) } },
      { type: "video", variant: "video-split", props: { title: "شوفه وهو شغال", subtitle: "فيديو حقيقي للجهاز من غير مونتاج.", cta_label: "اطلبه دلوقتي" } },
      { type: "product_showcase", variant: "stacked", props: { highlights: highlights([["battery", "بطارية تكفي يومين"], ["shield_check", "ضمان استبدال سنة"], ["droplet", "مقاوم للمية والعرق"]]) } },
      { type: "comparison", variant: "check-table", props: { title: "قارن قبل ما تشتري", us_label: "جهازنا", them_label: "المقلّد", rows: [{ feature: "ضمان سنة استبدال", us: true, them: false }, { feature: "بطارية أصلية", us: true, them: false }, { feature: "فحص قبل الدفع", us: true, them: false }, { feature: "سعر مناسب", us: true, them: true }] } },
      { type: "features", variant: "icon-list", props: { title: "المواصفات اللي هتفرق معاك", items: features([["zap", "شحن سريع", "من صفر لـ 80% في 40 دقيقة."], ["battery", "بطارية تعيش", "استخدام عادي لحد يومين."], ["lock", "حماية بياناتك", "تحديثات أمان مستمرة."]]) } },
      { type: "offers", variant: "countdown-strip" },
      { type: "testimonials", variant: "screenshots-grid", props: { title: "رسايل العملاء" } },
      { type: "faq", variant: "numbered", props: { items: faq([["الضمان بيشمل إيه؟", "استبدال الجهاز لو فيه أي عيب صناعة خلال سنة."], ["ينفع أفحصه قبل ما أدفع؟", "أيوه، افتح الشحنة وجرّب قدام المندوب."], ["التوصيل بياخد قد إيه؟", "من يوم لـ 3 أيام حسب المحافظة."]]) } },
      { type: "order_form", variant: "sticky-summary", props: { title: "اطلب دلوقتي، وافحص قبل ما تدفع" } },
      { type: "sticky_cta", variant: "full-bar", props: { cta_label: "اطلب بالدفع عند الاستلام" } },
      { type: "footer", variant: "minimal-line" },
    ],
  },
  {
    key: "home-warm",
    niche: "home",
    themeKey: "malak",
    design: {
      colors: { primary: "#4D7C0F", primary_foreground: "#FFFFFF", secondary: "#F4F7EC", accent: "#D97706", background: "#FFFDF8", foreground: "#1F2A14", muted: "#6B705C", border: "#E7E5D8" },
      font_heading: "cairo",
      font_body: "tajawal",
      button_radius: "lg",
    },
    sections: [
      { type: "header", variant: "logo-start" },
      { type: "hero", variant: "full-cover", props: { eyebrow: "لبيت أحلى", title: "وفّري وقتك في المطبخ كل يوم", subtitle: "أداة واحدة بتعمل شغل خمسة، سهلة في التنضيف وبتتشال في درج.", cta_label: "اطلبيها دلوقتي", badges: badges(["خامة آمنة على الأكل", "سهلة التنضيف", "ضمان 6 شهور"]) } },
      { type: "video", variant: "framed", props: { title: "شوفيها وهي شغالة" } },
      { type: "features", variant: "alternating", props: { title: "هتفرق معاكي في إيه؟", items: features([["clock", "توفير وقت", "التقطيع والفرم في ثواني بدل نص ساعة."], ["shield_check", "خامة آمنة", "بلاستيك غذائي خالي من BPA وستانلس ستيل."], ["droplet", "تنضيف في دقيقة", "بتتفك وتتغسل في الحوض أو غسالة الأطباق."]]) } },
      { type: "gallery", variant: "grid", props: { title: "من كل الزوايا" } },
      { type: "comparison", variant: "versus-cards", props: { title: "الفرق واضح", us_label: "مع الأداة", them_label: "من غيرها", rows: [{ feature: "تحضير الأكل في 5 دقايق", us: true, them: false }, { feature: "تقطيع متساوي ونضيف", us: true, them: false }, { feature: "إيدك بعيد عن السكينة", us: true, them: false }] } },
      { type: "testimonials", variant: "grid", props: { title: "ستات جربوها", items: reviews([["أم ياسين", "مدينة نصر", "بقيت أخلص السلطة في دقيقتين. أحسن حاجة اشتريتها للمطبخ.", 5], ["دينا", "بورسعيد", "سهلة جدًا في التنضيف وشكلها شيك على الرخامة.", 5], ["هبة", "المنيا", "وصلت سليمة ومعاها كل القطع.", 4]]) } },
      { type: "offers", variant: "ribbon-banner" },
      { type: "faq", variant: "two-columns", props: { items: faq([["بتيجي معاها إيه؟", "الجهاز و4 شفرات مختلفة وغطا وكتيب استخدام بالعربي."], ["لو فيها عيب؟", "ضمان 6 شهور استبدال مباشر."], ["الدفع إزاي؟", "كاش عند الاستلام."]]) } },
      { type: "order_form", variant: "split-summary", props: { title: "اطلبيها دلوقتي والدفع عند الاستلام" } },
      { type: "sticky_cta", variant: "full-bar", props: { cta_label: "اطلبيها دلوقتي" } },
      { type: "footer", variant: "columns" },
    ],
  },
  {
    key: "kids-playful",
    niche: "kids",
    themeKey: "malak",
    design: {
      colors: { primary: "#0369A1", primary_foreground: "#FFFFFF", secondary: "#EFF8FF", accent: "#F59E0B", background: "#FFFFFF", foreground: "#1E293B", muted: "#64748B", border: "#E2E8F0" },
      font_heading: "readex_pro",
      font_body: "almarai",
      button_radius: "full",
    },
    sections: [
      { type: "header", variant: "centered-logo", props: { announcement_enabled: true, announcement_text: "هدية مجانية مع كل طلب 🎁" } },
      { type: "hero", variant: "centered-card", props: { eyebrow: "لعب وتعلّم", title: "لعبة بتطوّر مهارات طفلك وهو بيلعب", subtitle: "خامة آمنة ومطابقة للمواصفات، مناسبة من 3 سنين، وبتشغله بعيد عن الموبايل.", cta_label: "اطلبها لطفلك", badges: badges(["آمنة للأطفال", "بتنمّي التركيز", "دفع عند الاستلام"]) } },
      { type: "features", variant: "icon-cards", props: { title: "ليه الأمهات بيحبوها؟", items: features([["shield_check", "خامة آمنة", "ألوان مائية خالية من الرصاص وحواف ناعمة."], ["smile", "بتبعده عن الشاشات", "بيقعد يلعب بيها ساعات من غير ملل."], ["sparkles", "بتنمّي مهاراته", "التركيز والألوان والأشكال والحركة."]]) } },
      { type: "gallery", variant: "slider", props: { title: "شوفوها من قريب" } },
      { type: "product_showcase", variant: "card" },
      { type: "testimonials", variant: "cards-slider", props: { title: "أمهات جربوها", items: reviews([["أم مالك", "الجيزة", "ابني بقى بيقعد يلعب بيها بدل التابلت، وفرحان إنه بيخلص الأشكال لوحده.", 5], ["رحاب", "الزقازيق", "الخامة تقيلة ومحترمة والألوان زي الصور بالظبط.", 5], ["أم جنى", "الإسماعيلية", "هدية عيد ميلاد ممتازة.", 5]]) } },
      { type: "offers", variant: "cards", props: { title: "عروض للإخوات" } },
      { type: "faq", variant: "accordion-soft", props: { items: faq([["مناسبة لسن كام؟", "من 3 سنين لحد 8 سنين."], ["فيها قطع صغيرة؟", "مفيش قطع صغيرة تتبلع، وكل الحواف ناعمة."], ["ينفع أبدّلها؟", "أيوه خلال 14 يوم لو مفتوحتش."]]) } },
      { type: "order_form", variant: "card", props: { title: "اطلبها دلوقتي والدفع عند الاستلام" } },
      { type: "sticky_cta", variant: "pill", props: { cta_label: "اطلبها لطفلك" } },
      { type: "footer", variant: "simple-center" },
    ],
  },
  {
    key: "health-energy",
    niche: "health",
    themeKey: "celia",
    design: {
      colors: { primary: "#15803D", primary_foreground: "#FFFFFF", secondary: "#ECFDF3", accent: "#FACC15", background: "#FFFFFF", foreground: "#0F1A12", muted: "#4B5B50", border: "#DDE7E0" },
      font_heading: "noto_kufi",
      font_body: "cairo",
      button_radius: "md",
    },
    sections: [
      { type: "header", variant: "bar", props: { announcement_enabled: true, announcement_text: "العرض لفترة محدودة: اشتري 2 والتالت هدية" } },
      { type: "hero", variant: "big-type", props: { eyebrow: "طاقة طول اليوم", title: "نشاط أكتر وتعب أقل من غير منبهات", subtitle: "مكمّل طبيعي بفيتامينات ومعادن بتساعدك تكمّل يومك وتمرينك بطاقة.", cta_label: "ابدأ النهارده", badges: badges(["مكونات طبيعية", "مصرّح من وزارة الصحة", "دفع عند الاستلام"]) } },
      { type: "before_after", variant: "two-images", props: { title: "قبل وبعد 30 يوم", subtitle: "نتايج عملاء حقيقيين التزموا بالبرنامج" } },
      { type: "features", variant: "numbered-grid", props: { title: "بيعمل إيه في جسمك؟", items: features([["zap", "طاقة ثابتة", "من غير هبوط مفاجئ زي القهوة والمشروبات."], ["heart", "مناعة أقوى", "فيتامين C والزنك وفيتامين D."], ["leaf", "طبيعي 100%", "من غير سكر ولا مواد حافظة."]]) } },
      { type: "countdown", variant: "banner", props: { title: "العرض بيخلص قريب", subtitle: "اشتري 2 والتالت هدية لحد ما العدّاد يخلص", minutes: 240 } },
      { type: "comparison", variant: "versus-cards", props: { title: "الفرق بيننا وبين غيرنا", us_label: "منتجنا", them_label: "المنتجات العادية", rows: [{ feature: "مكونات طبيعية من غير سكر", us: true, them: false }, { feature: "مصرّح من وزارة الصحة", us: true, them: false }, { feature: "الدفع عند الاستلام", us: true, them: true }] } },
      { type: "testimonials", variant: "quote-wall", props: { title: "اللي جربوه قالوا", items: reviews([["أحمد", "6 أكتوبر", "بقيت أكمّل التمرين من غير ما أتعب في النص، وده من تاني أسبوع.", 5], ["رنا", "الإسكندرية", "مبقتش محتاجة 3 فناجين قهوة عشان أكمّل الشغل.", 5], ["محمود", "سوهاج", "طعمه كويس والعبوة بتكفي شهر كامل.", 4]]) } },
      { type: "offers", variant: "bundle-tiles", props: { title: "وفّر مع الباقات" } },
      { type: "faq", variant: "accordion-lines", props: { items: faq([["آخده إزاي؟", "كبسولة واحدة الصبح بعد الفطار."], ["له أعراض جانبية؟", "مكوناته طبيعية، ولو عندك حالة مزمنة استشير دكتورك الأول."], ["النتيجة بتبان إمتى؟", "أغلب الناس بيحسوا بفرق في الطاقة خلال أسبوع."]]) } },
      { type: "order_form", variant: "bordered", props: { title: "اطلب دلوقتي والدفع عند الاستلام" } },
      { type: "sticky_cta", variant: "full-bar", props: { cta_label: "ابدأ النهارده" } },
      { type: "footer", variant: "dark-columns" },
    ],
  },
  {
    key: "luxury-night",
    niche: "luxury",
    themeKey: "layali",
    design: {
      colors: { primary: "#C9A227", primary_foreground: "#14110B", secondary: "#FBF5E6", accent: "#E9C46A", background: "#FFFDF8", foreground: "#14110B", muted: "#6B6458", border: "#ECE4D3" },
      font_heading: "readex_pro",
      font_body: "ibm_plex_arabic",
      button_radius: "full",
    },
    sections: [
      { type: "header", variant: "glass-bar", props: { announcement_enabled: true, announcement_text: "تغليف هدايا فاخر مجانًا مع كل طلب ✨" } },
      { type: "hero", variant: "glow-center", props: { eyebrow: "إصدار محدود", title: "حضور يفضل في الذاكرة", subtitle: "عطر بثبات يكمّل معاك اليوم كله، بتركيبة فرنسية وزجاجة تليق بالهدية.", cta_label: "اطلبه الآن", badges: badges(["ثبات 12 ساعة", "تغليف هدايا", "دفع عند الاستلام"]) } },
      { type: "product_showcase", variant: "luxe-split", props: { highlights: highlights([["gem", "زيوت عطرية مستوردة"], ["clock", "ثبات حتى 12 ساعة"], ["gift", "علبة فاخرة جاهزة للإهداء"]]), cta_label: "اطلبه هدية" } },
      { type: "video", variant: "video-split", props: { title: "شوف العلبة وهي بتتفتح", subtitle: "تفاصيل الزجاجة والتغليف قبل ما يوصلك.", cta_label: "اطلبه الآن" } },
      { type: "features", variant: "glow-timeline", props: { title: "رحلة العطر", items: features([["sparkles", "المقدمة", "برغموت وفلفل وردي بيلفتوا الانتباه من أول رشة."], ["heart", "القلب", "عود وورد طائفي بيدّوا دفا وفخامة."], ["leaf", "القاعدة", "مسك وعنبر بيفضلوا معاك لآخر اليوم."]]) } },
      { type: "comparison", variant: "versus-cards", props: { title: "الأصلي يفرق", us_label: "عطرنا", them_label: "التقليد", rows: [{ feature: "ثبات طول اليوم", us: true, them: false }, { feature: "زيوت مستوردة", us: true, them: false }, { feature: "علبة هدايا فاخرة", us: true, them: false }, { feature: "سعر مناسب", us: true, them: true }] } },
      { type: "testimonials", variant: "quote-masonry", props: { title: "اللي جربوه", items: reviews([["هالة", "الشيخ زايد", "جوزي سألني عن اسمه من أول يوم، والريحة فضلت لحد بالليل.", 5], ["عمر", "مصر الجديدة", "اشتريته هدية والعلبة شكلها غالي جدًا.", 5], ["ريم", "المنصورة", "ثباته أحسن من عطور ماركات بضعف السعر.", 5]]) } },
      { type: "offers", variant: "spotlight" },
      { type: "countdown", variant: "boxes", props: { title: "الإصدار المحدود بيخلص", subtitle: "الكمية محدودة والعرض لفترة قصيرة", minutes: 240 } },
      { type: "faq", variant: "split-glow", props: { items: faq([["الثبات قد إيه؟", "من 8 لـ 12 ساعة على الجلد حسب نوع البشرة والجو."], ["ينفع أهاديه؟", "أيوه، بيوصل في علبة فاخرة وتقدر تكتب اسم المُهدى إليه في الملاحظات."], ["لو مش عاجبني؟", "تقدر ترجعه خلال 14 يوم لو مفتوحش."]]) } },
      { type: "order_form", variant: "split-luxe", props: { title: "اطلبه الآن والدفع عند الاستلام" } },
      { type: "sticky_cta", variant: "pill", props: { cta_label: "اطلبه الآن" } },
      { type: "footer", variant: "signature" },
    ],
  },
];

export function getTemplate(key: string | null | undefined): PageTemplate | null {
  return TEMPLATES.find((template) => template.key === key) ?? null;
}

/** Page content for a new page from a template (fresh ids; page look optional). */
export function templateContent(template: PageTemplate, { withDesign = true } = {}): PageContent {
  return {
    version: 1,
    sections: template.sections.map(({ type, variant, props }) => ({ id: crypto.randomUUID(), type, variant, visible: true, props: { ...defaultProps(type), ...(props ?? {}) } })),
    ...(withDesign ? { design: structuredClone(template.design) } : {}),
  };
}
