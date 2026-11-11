/** Form validation messages (zod) and request errors. */
export const validation = {
  required: "الخانة دي مطلوبة",
  email: "البريد الإلكتروني مش مظبوط",
  phone: "رقم الموبايل مش مظبوط",
  min: (n: number) => `لازم ${n} حروف على الأقل`,
  max: (n: number) => `أقصى حاجة ${n} حرف`,
  passwordMin: "كلمة المرور لازم تكون 8 حروف على الأقل",
} as const;

export const errors = {
  generic: "حصلت مشكلة غير متوقعة. جرّب تاني.",
  network: "مقدرناش نوصل للسيرفر. اتأكد من الإنترنت وجرّب تاني.",
  forbidden: "مش مسموح لك تعمل الإجراء ده.",
  notFound: "الصفحة دي مش موجودة.",
} as const;
