import { formatMoney, formatNumber } from "@/lib/format";

/** «شابع»: what the visitor reads on the food landing page (form labels come from «بداية» and checkout). */
export const shabe = {
  endsIn: "العرض بيخلص خلال",
  units: { days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية" },
  ended: "العرض خلص",
  call: "اتصل بينا",
  save: (amount: number) => `وفّر ${formatMoney(amount)}`,
  off: (n: number) => `-${formatNumber(n)}%`,
  ratingLine: (avg: number, count: number) => `${avg} · من ${formatNumber(count)} تقييم`,
  bundles: {
    best: "الأكتر طلبًا",
    choose: "اختار ده",
    chosen: "اخترته",
    piece: "قطعة واحدة",
    pieces: (n: number) => (n === 1 ? "قطعة واحدة" : n === 2 ? "قطعتين" : `${formatNumber(n)} قطع`),
    saveOff: (n: number) => `وفّر ${formatNumber(n)}%`,
    builderEmpty: "الكروت بتظهر هنا من عروض المنتج. ضيف عرض للمنتج، أو اكتب كروتك من الإعدادات.",
    builderMissing: "العرض ده مش شغال دلوقتي، والكارت مش هيظهر للزوار.",
  },
  menu: { builderEmpty: "ضيف صور الأصناف من الإعدادات." },
  testimonials: {
    score: (count: number) => `من ${formatNumber(count)} تقييم`,
    verified: "اشترى فعلًا",
    builderEmpty: "آراء العملاء بتظهر هنا أول ما يكتبوها، أو اكتبها بنفسك من الإعدادات.",
  },
  urgency: {
    left: (n: number) => `باقي ${formatNumber(n)} بس`,
    builderHint: "حط معاد انتهاء العرض أو شغّل «الكمية الباقية»، وإلا القسم مش هيظهر.",
  },
  video: { play: "شغّل الفيديو" },
  gallery: { image: (n: number) => `صورة ${formatNumber(n)}` },
} as const;
