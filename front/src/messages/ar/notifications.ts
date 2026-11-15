/** The bell (dashboard + admin) and where notifications go. */
export const notifications = {
  bell: {
    title: "الإشعارات",
    open: "الإشعارات",
    unread: (n: number) => (n > 99 ? "+99" : String(n)),
    markAll: "علّم الكل مقروء",
    empty: "مفيش إشعارات لسه",
    emptyText: "هتلاقي هنا الطلبات الجديدة، والمخزون، والباقة، وردود الدعم.",
    more: "أقدم",
    error: "معرفناش نجيب الإشعارات.",
    retry: "حاول تاني",
  },
  channel: {
    title: "الإشعارات",
    description: "كل الإشعارات بتظهر في الجرس جوه لوحة التحكم. واختار كمان توصلك فين برّه.",
    whatsapp: "واتساب",
    whatsappHint: (phone: string) => `على رقمك ${phone}`,
    email: "الإيميل",
    emailHint: (email: string) => `على ${email}`,
    saved: "اتحفظ",
    fallback: "لو رسالة الواتساب معرفتش توصل، هتوصلك على الإيميل بدلها.",
  },
} as const;
