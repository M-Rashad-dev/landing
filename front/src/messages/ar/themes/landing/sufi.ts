import { formatMoney, formatNumber } from "@/lib/format";

/** «صوفي · صفحة هبوط»: what the visitor reads (form labels come from «بداية» and checkout). */
export const sufiLanding = {
  toDark: "الوضع الليلي",
  toLight: "الوضع العادي",
  save: (amount: number) => `وفّر ${formatMoney(amount)}`,
  off: (n: number) => `خصم ${formatNumber(n)}%`,
  ratingLine: (avg: number, count: number) => `${avg} من 5 · ${formatNumber(count)} تقييم`,
  units: { days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية" },
  bundles: {
    best: "الأوفر",
    choose: "اختار العرض ده",
    chosen: "اخترته",
    piece: "قطعة واحدة",
    pieces: (n: number) => (n === 1 ? "قطعة واحدة" : n === 2 ? "قطعتين" : `${formatNumber(n)} قطع`),
    saveOff: (n: number) => `وفّر ${formatNumber(n)}%`,
    builderEmpty: "الكروت بتظهر هنا من عروض المنتج. ضيف عرض للمنتج، أو اكتب كروتك من الإعدادات.",
    builderMissing: "العرض ده مش شغال دلوقتي، والكارت مش هيظهر للزوار.",
  },
  testimonials: {
    score: (count: number) => `من ${formatNumber(count)} تقييم`,
    verified: "اشترى فعلًا",
    builderEmpty: "آراء العملاء بتظهر هنا أول ما يكتبوها، أو اكتبها بنفسك من الإعدادات.",
  },
  countdown: {
    left: (n: number) => `باقي ${formatNumber(n)} قطعة بس`,
    builderHint: "حط معاد انتهاء العرض أو شغّل «الكمية الباقية»، وإلا القسم مش هيظهر.",
  },
  video: { play: "شغّل الفيديو" },
  gallery: { image: (n: number) => `صورة ${formatNumber(n)}` },
  form: { yourOrder: "طلبك" },
} as const;
