import { formatNumber } from "@/lib/format";

/** «رواق · صفحة هبوط»: what the visitor reads (form labels come from «بداية» and checkout). */
export const rawaqLanding = {
  off: (n: number) => `خصم ${formatNumber(n)}%`,
  ratingLine: (avg: number, count: number) => `${formatNumber(avg)} من 5 · ${formatNumber(count)} تقييم`,
  units: { days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية" },
  bundles: {
    best: "الأوفر",
    choose: "اختاري العرض ده",
    chosen: "اخترتيه",
    piece: "قطعة واحدة",
    pieces: (n: number) => (n === 1 ? "قطعة واحدة" : n === 2 ? "قطعتين" : `${formatNumber(n)} قطع`),
    saveOff: (n: number) => `وفّري ${formatNumber(n)}%`,
    builderEmpty: "الكروت بتظهر هنا من عروض المنتج. ضيفي عرض للمنتج، أو اكتبي كروتك من الإعدادات.",
    builderMissing: "العرض ده مش شغال دلوقتي، والكارت مش هيظهر للزوار.",
  },
  testimonials: {
    score: (count: number) => `من ${formatNumber(count)} تقييم`,
    verified: "اشترت فعلًا",
    builderEmpty: "آراء العميلات بتظهر هنا أول ما يكتبوها، أو اكتبيها بنفسك من الإعدادات.",
  },
  countdown: {
    left: (n: number) => `فاضل ${formatNumber(n)} بس`,
    builderHint: "حطي معاد انتهاء العرض أو شغّلي «الكمية الباقية»، وإلا القسم مش هيظهر.",
  },
  beforeAfter: { drag: "اسحبي عشان تشوفي الفرق", empty: "اختاري صورة «قبل» وصورة «بعد» من الإعدادات." },
  howTo: { step: (n: number) => `الخطوة ${formatNumber(n)}` },
  video: { play: "شغّلي الفيديو" },
  gallery: { image: (n: number) => `صورة ${formatNumber(n)}` },
} as const;
