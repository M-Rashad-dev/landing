/** Platform words shared by several screens (statuses, plans, money). */
export const domain = {
  orderStatus: {
    new: "جديد",
    confirmed: "مؤكد",
    delivered: "تم التسليم",
    returned: "مرتجع",
    damaged: "تالف",
    fake: "وهمي",
    cancelled: "ملغي",
  },
  invoiceStatus: {
    open: "مفتوحة",
    pending_review: "قيد المراجعة",
    paid: "مدفوعة",
    cancelled: "ملغية",
    expired: "منتهية",
    refunded: "مسترجعة",
  },
  productState: { active: "نشط", inactive: "متوقف", outOfStock: "نفد", lowStock: (n: number) => `باقي ${n}`, overLimit: "فوق حد الباقة" },
  storeState: { live: "المتجر شغال", off: "المتجر متوقف" },
  source: { store: "المتجر", landing: "صفحة هبوط" },
  plan: { basic: "بيسك", pro: "برو", max: "ماكس", perMonth: "شهريًا", perYear: "سنويًا", current: "باقتك الحالية", choose: "اختار الباقة" },
  theme: { free: "مجاني", owned: "ملكك", buy: (price: string) => `اشتري بـ ${price}`, preview: "معاينة" },
} as const;
